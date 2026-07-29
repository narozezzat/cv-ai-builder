"use client";

/**
 * The match, orchestrated from the browser.
 *
 * Three steps, and only two of them cost anything:
 *
 * 1. `extract` — one metered request turning pasted prose into structure.
 * 2. `scoreJobMatch` — pure TypeScript, run here against the live store document.
 * 3. `gaps` — a second metered request, and deliberately *not* automatic. It is worth a
 *    credit only once the user has read the score and wants prose about it.
 *
 * Because step 2 is local and free, `rescore` exists: edit the resume, re-check, watch
 * the number move, with no request and no charge. That loop is the feature. It is also
 * why the posting is held in state rather than refetched — the extraction of a posting
 * that has not changed is the same extraction.
 *
 * `asOf` is read from the clock here, at the moment of scoring, and passed in. The
 * scorer never reads it itself, which is what keeps its output a function of its
 * arguments and its determinism a unit test. Doing it in this hook is safe because
 * nothing here runs on the server: no render on either side depends on the value.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  explainJobGapsAction,
  extractJobRequirementsAction,
  type AiActionFailure,
  type AiActionResult,
} from "@/features/ai";
import type { JobMatchExtractOutput, JobMatchGapsOutput } from "@/services/ai";
import type { ResumeDocument } from "@/types/resume";

import { scoreJobMatch, type AtsScore } from "../lib/ats-score";
import { buildGapsInput } from "../lib/gaps-input";
import { buildResumeIndex } from "../lib/resume-index";

export type JobMatchStatus = "idle" | "loading" | "ready" | "error";
export type JobGapsStatus = "idle" | "loading" | "ready" | "error";

export interface JobMatchOutcome {
  readonly posting: JobMatchExtractOutput;
  readonly score: AtsScore;
  /**
   * The total before the most recent `rescore`, so the report can show movement.
   * `null` until the first re-check, because "no change" and "not yet compared" are
   * different things to say.
   */
  readonly previousTotal: number | null;
}

export interface UseJobMatchOptions {
  /** Attributed on the usage row, so a user can see which resume spent the credit. */
  resumeId: string | null;
  /**
   * Reads the document at call time rather than receiving it as a prop.
   *
   * A subscription here would re-render the dialog's owner on every keystroke in the
   * editor, and scoring is not continuous — it happens on submit and on re-check.
   */
  getDocument: () => ResumeDocument;
}

export interface UseJobMatchResult {
  status: JobMatchStatus;
  outcome: JobMatchOutcome | null;
  failure: AiActionFailure | null;
  gapsStatus: JobGapsStatus;
  gaps: JobMatchGapsOutput | null;
  gapsFailure: AiActionFailure | null;
  /** Balance after the last charge, for the footer. `null` until one lands. */
  creditsRemaining: number | null;
  /** Extracts the posting and scores it. Costs one credit. */
  match: (jobDescription: string) => void;
  /** Re-scores the held posting against the current document. Free. */
  rescore: () => void;
  /** Asks the model to explain the gaps it is handed. Costs one credit. */
  requestGaps: () => void;
  /** Back to the paste form, discarding the posting and anything in flight. */
  reset: () => void;
}

/** What the current month looks like to `buildResumeIndex`. */
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * A transport failure, as opposed to one the action reported.
 *
 * The action maps every server-side failure into a result, so reaching this means the
 * request never came back: a dropped connection, or a deploy mid-flight. Whether the
 * credit was spent is unknowable from here, which is why the copy does not promise.
 */
const TRANSPORT_FAILURE: AiActionFailure = {
  ok: false,
  code: "unknown",
  error: "That request did not complete. Check your connection and try again.",
  retryable: true,
};

export function useJobMatch({ resumeId, getDocument }: UseJobMatchOptions): UseJobMatchResult {
  const [status, setStatus] = useState<JobMatchStatus>("idle");
  const [outcome, setOutcome] = useState<JobMatchOutcome | null>(null);
  const [failure, setFailure] = useState<AiActionFailure | null>(null);

  const [gapsStatus, setGapsStatus] = useState<JobGapsStatus>("idle");
  const [gaps, setGaps] = useState<JobMatchGapsOutput | null>(null);
  const [gapsFailure, setGapsFailure] = useState<AiActionFailure | null>(null);

  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);

  /**
   * Re-read on every request, so callers need memoize nothing.
   *
   * `outcome` is mirrored here too: the gap request has to send the score that is on
   * screen, and reading it out of a `setState` updater would make that updater impure.
   */
  const latest = useRef({ resumeId, getDocument, outcome });

  useEffect(() => {
    latest.current = { resumeId, getDocument, outcome };
  });

  /**
   * Which request each pane is showing.
   *
   * A server action is a `fetch` whose signal we do not hold, so this is not
   * cancellation — the work finishes and the credit is spent either way. It stops a
   * superseded or abandoned response from overwriting state, including after unmount.
   */
  const matchId = useRef(0);
  const gapsId = useRef(0);

  useEffect(
    () => () => {
      matchId.current += 1;
      gapsId.current += 1;
    },
    [],
  );

  const match = useCallback((jobDescription: string) => {
    const id = matchId.current + 1;
    matchId.current = id;
    // A new posting invalidates advice about the old one.
    gapsId.current += 1;

    setStatus("loading");
    setFailure(null);
    setGapsStatus("idle");
    setGaps(null);
    setGapsFailure(null);

    void (async () => {
      let result: AiActionResult<JobMatchExtractOutput>;

      try {
        result = await extractJobRequirementsAction(
          { jobDescription },
          { resumeId: latest.current.resumeId },
        );
      } catch (cause) {
        console.error("[jobmatch] extraction failed in transit", cause);

        if (matchId.current !== id) return;

        setOutcome(null);
        setFailure(TRANSPORT_FAILURE);
        setStatus("error");
        return;
      }

      if (matchId.current !== id) return;

      if (!result.ok) {
        setOutcome(null);
        setFailure(result);
        setStatus("error");
        return;
      }

      const document = latest.current.getDocument();
      const index = buildResumeIndex(document, { asOf: currentMonth() });

      setOutcome({
        posting: result.data,
        score: scoreJobMatch(result.data, index),
        previousTotal: null,
      });
      setCreditsRemaining(result.creditsRemaining);
      setStatus("ready");
    })();
  }, []);

  const rescore = useCallback(() => {
    setOutcome((current) => {
      if (!current) return current;

      const index = buildResumeIndex(latest.current.getDocument(), { asOf: currentMonth() });

      return {
        posting: current.posting,
        score: scoreJobMatch(current.posting, index),
        previousTotal: current.score.total,
      };
    });
  }, []);

  const requestGaps = useCallback(() => {
    const current = latest.current.outcome;

    // Nothing to explain without a score. The button is disabled in that state, so
    // this is the guard for a keyboard or command-palette path around it.
    if (!current) return;

    const id = gapsId.current + 1;
    gapsId.current = id;

    setGapsStatus("loading");
    setGapsFailure(null);

    void (async () => {
      const input = buildGapsInput(current.posting, current.score, latest.current.getDocument());

      let result: AiActionResult<JobMatchGapsOutput>;

      try {
        result = await explainJobGapsAction(input, { resumeId: latest.current.resumeId });
      } catch (cause) {
        console.error("[jobmatch] gap explanation failed in transit", cause);

        if (gapsId.current !== id) return;

        setGaps(null);
        setGapsFailure(TRANSPORT_FAILURE);
        setGapsStatus("error");
        return;
      }

      if (gapsId.current !== id) return;

      if (!result.ok) {
        setGaps(null);
        setGapsFailure(result);
        setGapsStatus("error");
        return;
      }

      setGaps(result.data);
      setCreditsRemaining(result.creditsRemaining);
      setGapsStatus("ready");
    })();
  }, []);

  const reset = useCallback(() => {
    matchId.current += 1;
    gapsId.current += 1;

    setStatus("idle");
    setOutcome(null);
    setFailure(null);
    setGapsStatus("idle");
    setGaps(null);
    setGapsFailure(null);
  }, []);

  return {
    status,
    outcome,
    failure,
    gapsStatus,
    gaps,
    gapsFailure,
    creditsRemaining,
    match,
    rescore,
    requestGaps,
    reset,
  };
}
