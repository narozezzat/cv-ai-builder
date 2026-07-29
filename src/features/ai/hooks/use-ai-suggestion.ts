"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AiActionFailure, AiActionResult } from "../lib/ai-action-result";
import type { AiSuggestion } from "../lib/suggestion";

/**
 * One AI request's lifecycle, held outside the document.
 *
 * The point of this hook is that nothing it holds is in the resume store. A
 * suggestion the user rejects must leave no trace, and the store's single write path
 * records every change as an undo entry — so a suggestion written there to be
 * "previewed" is a suggestion the user has to undo to be rid of. It lives here until
 * accept, and accept is the caller's one store write.
 *
 * The other reason this is a hook rather than component state: variant paging is
 * credit accounting. `summary.generate` returns up to three variants for one charge,
 * so "regenerate" has to page through what was already paid for before spending
 * again. `nextCostsCredit` is what lets the button say which one it is about to do.
 */

export type AiSuggestionStatus = "idle" | "loading" | "ready" | "empty" | "error";

export interface UseAiSuggestionOptions<TData, TSuggestion extends AiSuggestion> {
  /**
   * Calls the server action. Re-read from a ref on every request, so a call site can
   * close over current field values without memoizing anything.
   */
  run: () => Promise<AiActionResult<TData>>;
  /** Flattens the capability's output into what the popover renders. */
  toSuggestions: (data: TData) => TSuggestion[];
}

export interface UseAiSuggestionResult<TSuggestion extends AiSuggestion> {
  status: AiSuggestionStatus;
  /** Every variant from the last successful response, in the order returned. */
  suggestions: TSuggestion[];
  /** The one on screen, or `null` outside `ready`. */
  current: TSuggestion | null;
  index: number;
  failure: AiActionFailure | null;
  /** Balance after the last charge, for the popover footer. `null` until one lands. */
  creditsRemaining: number | null;
  request: () => void;
  /** Next cached variant, or a fresh request when they are exhausted. */
  next: () => void;
  /** Discards the suggestion and any request in flight. */
  reset: () => void;
  /** Whether `next` will spend a credit, so the button can say so. */
  nextCostsCredit: boolean;
}

export function useAiSuggestion<TData, TSuggestion extends AiSuggestion>({
  run,
  toSuggestions,
}: UseAiSuggestionOptions<TData, TSuggestion>): UseAiSuggestionResult<TSuggestion> {
  const [status, setStatus] = useState<AiSuggestionStatus>("idle");
  const [suggestions, setSuggestions] = useState<TSuggestion[]>([]);
  const [index, setIndex] = useState(0);
  const [failure, setFailure] = useState<AiActionFailure | null>(null);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);

  const callbacks = useRef({ run, toSuggestions });

  useEffect(() => {
    callbacks.current = { run, toSuggestions };
  });

  /**
   * Which request the UI is currently showing.
   *
   * A server action is a `fetch` we do not hold the signal for, so this is not
   * cancellation — the work still completes on the server and the credit is still
   * spent. It is the guard that keeps a superseded or abandoned response from
   * overwriting state, including after unmount, where committing it would warn and
   * would resurrect a popover the user closed.
   */
  const requestId = useRef(0);

  useEffect(
    () => () => {
      requestId.current += 1;
    },
    [],
  );

  const request = useCallback(() => {
    const id = requestId.current + 1;
    requestId.current = id;

    setStatus("loading");
    setFailure(null);

    void (async () => {
      try {
        const result = await callbacks.current.run();

        if (requestId.current !== id) return;

        if (!result.ok) {
          setSuggestions([]);
          setIndex(0);
          setFailure(result);
          setStatus("error");
          return;
        }

        const next = callbacks.current.toSuggestions(result.data);

        setSuggestions(next);
        setIndex(0);
        setCreditsRemaining(result.creditsRemaining);
        setStatus(next.length > 0 ? "ready" : "empty");
      } catch (cause) {
        if (requestId.current !== id) return;

        // The action itself maps every failure to a result, so reaching here means
        // the transport did: a dropped connection, or a deploy mid-request. The
        // server-side charge is unknowable from here, hence the honest copy.
        console.error("[ai] suggestion request failed in transit", cause);

        setSuggestions([]);
        setIndex(0);
        setFailure({
          ok: false,
          code: "unknown",
          error: "That request did not complete. Check your connection and try again.",
          retryable: true,
        });
        setStatus("error");
      }
    })();
  }, []);

  const nextCostsCredit = status !== "ready" || index >= suggestions.length - 1;

  const next = useCallback(() => {
    if (nextCostsCredit) {
      request();
      return;
    }

    setIndex((current) => current + 1);
  }, [nextCostsCredit, request]);

  const reset = useCallback(() => {
    requestId.current += 1;

    setStatus("idle");
    setSuggestions([]);
    setIndex(0);
    setFailure(null);
  }, []);

  return {
    status,
    suggestions,
    current: status === "ready" ? (suggestions[index] ?? null) : null,
    index,
    failure,
    creditsRemaining,
    request,
    next,
    reset,
    nextCostsCredit,
  };
}
