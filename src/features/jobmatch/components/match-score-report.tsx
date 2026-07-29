"use client";

/**
 * The score, and everything that produced it.
 *
 * Nothing here is generated. Every number comes from `scoreJobMatch`, and every
 * component prints its own `detail` sentence, so the report can answer "why 62?" without
 * a second request. That is the whole argument for scoring in TypeScript.
 *
 * A `"use client"` leaf by necessity: Base UI types `ProgressValue`'s child as a
 * function, and a function crossing the server boundary takes the route to its error
 * boundary.
 *
 * Order is fix order, not sorted-by-interest: what is missing comes before what matched,
 * because the missing list is the edit queue and the matched list is reassurance.
 */

import { ArrowDown, ArrowUp, Check, RotateCcw, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import type { AtsBand, AtsComponent, KeywordVerdict } from "../lib/ats-score";
import type { JobMatchOutcome } from "../hooks/use-job-match";
import { BAND_COPY, SENIORITY_LABELS, ZONE_LABELS } from "../schema/job-match-schema";

/**
 * Band colour. Not a gradient off the number, because the bands are the thresholds the
 * copy speaks in — a 79 and an 80 should look as different as they read.
 */
const BAND_STYLES: Record<AtsBand, { text: string; bar: string }> = {
  strong: { text: "text-success", bar: "**:data-[slot=progress-indicator]:bg-success" },
  solid: { text: "text-info", bar: "**:data-[slot=progress-indicator]:bg-info" },
  partial: { text: "text-warning", bar: "**:data-[slot=progress-indicator]:bg-warning" },
  weak: { text: "text-destructive", bar: "**:data-[slot=progress-indicator]:bg-destructive" },
};

export interface MatchScoreReportProps {
  outcome: JobMatchOutcome;
  /** Free: re-scores the held posting against the document as it stands now. */
  onRescore: () => void;
  /** Costs a credit, so the button says so and lives next to the score, not under it. */
  onRequestGaps: () => void;
  gapsRequested: boolean;
}

export function MatchScoreReport({
  outcome,
  onRescore,
  onRequestGaps,
  gapsRequested,
}: MatchScoreReportProps) {
  const { posting, score, previousTotal } = outcome;
  const band = BAND_STYLES[score.band];
  const copy = BAND_COPY[score.band];

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="truncate text-sm font-semibold">{posting.jobTitle}</h3>
            <p className="text-xs text-muted-foreground">
              {[
                posting.company,
                SENIORITY_LABELS[posting.seniority],
                posting.yearsExperience === null ? null : `${posting.yearsExperience}+ years asked`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <div className="flex items-baseline gap-2">
            <span className={cn("text-3xl font-semibold tabular-nums", band.text)}>
              {score.total}
            </span>
            <span className="text-xs text-muted-foreground">/ 100</span>
            <ScoreDelta total={score.total} previousTotal={previousTotal} />
          </div>
        </div>

        {/*
          No children: `Progress` renders its own track, so passing one would paint a
          second bar under the first. The band colour reaches the indicator through the
          root instead, which is also the only way to restyle it without editing the
          vendored primitive.
        */}
        <Progress
          value={score.total}
          aria-label={`Match score: ${score.total} out of 100 — ${copy.label}`}
          className={cn("**:data-[slot=progress-track]:h-1.5", band.bar)}
        />

        <p className="text-xs text-muted-foreground">
          <span className={cn("font-medium", band.text)}>{copy.label}.</span> {copy.summary}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="xs" onClick={onRescore}>
            <RotateCcw aria-hidden className="size-3.5" />
            Re-check — free
          </Button>

          {gapsRequested ? null : (
            <Button type="button" variant="outline" size="xs" onClick={onRequestGaps}>
              <Sparkles aria-hidden className="size-3.5" />
              Explain the gaps — 1 credit
            </Button>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Where the points came from
        </h4>

        <ul className="space-y-2">
          {score.components.map((component) => (
            <ComponentRow key={component.id} component={component} />
          ))}
        </ul>
      </section>

      {score.missing.length > 0 ? (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Not on your resume — in the order worth fixing
          </h4>
          <p className="text-xs text-muted-foreground">
            Add only what you have actually done. A keyword you cannot talk about in an interview
            costs more than the point it wins here.
          </p>

          <ul className="flex flex-wrap gap-1.5">
            {score.missing.map((verdict) => (
              <li key={`${verdict.pool}-${verdict.keyword}`}>
                <Badge variant={verdict.importance === "required" ? "destructive" : "secondary"}>
                  {verdict.keyword}
                  {verdict.importance === "required" ? (
                    <span className="sr-only"> (required)</span>
                  ) : null}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {score.matched.length > 0 ? (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Already covered
          </h4>

          <ul className="space-y-1">
            {score.matched.map((verdict) => (
              <MatchedRow key={`${verdict.pool}-${verdict.keyword}`} verdict={verdict} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Movement since the last re-check.
 *
 * Hidden entirely when the score did not move, rather than shown as "0" — an unchanged
 * number after an edit is information the user already has from the score itself.
 */
function ScoreDelta({ total, previousTotal }: { total: number; previousTotal: number | null }) {
  if (previousTotal === null || previousTotal === total) return null;

  const up = total > previousTotal;
  const delta = Math.abs(total - previousTotal);
  const Icon = up ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        "flex items-center gap-0.5 text-xs font-medium tabular-nums",
        up ? "text-success" : "text-destructive",
      )}
    >
      <Icon aria-hidden className="size-3" />
      {delta}
      <span className="sr-only">
        {up ? " points higher" : " points lower"} than the previous check
      </span>
    </span>
  );
}

function ComponentRow({ component }: { component: AtsComponent }) {
  return (
    <li className="space-y-1 rounded-md bg-muted/40 p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium">{component.label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {component.score} / {component.max}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{component.detail}</p>
    </li>
  );
}

function MatchedRow({ verdict }: { verdict: KeywordVerdict }) {
  return (
    <li className="flex items-baseline gap-1.5 text-xs">
      <Check aria-hidden className="mt-0.5 size-3 shrink-0 text-success" />
      <span className="font-medium">{verdict.keyword}</span>
      <span className="text-muted-foreground">
        {/* Strongest zone only. Listing all three reads as a keyword-stuffing scorecard. */}
        {ZONE_LABELS[verdict.zones[0]]}
      </span>
    </li>
  );
}
