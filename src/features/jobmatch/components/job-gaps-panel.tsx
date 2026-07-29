"use client";

/**
 * The prose half of the report: what the score cannot say.
 *
 * The scorer knows a keyword is absent. It cannot know whether that is a wording fix
 * or a career gap, and that distinction is the only reason this request is worth a
 * credit. So the panel leads with the gaps, ordered by severity, and each one carries
 * the model's advice rather than a restatement of the requirement.
 *
 * Recommendations come last and numbered, because the model is told to return them
 * ranked. Numbering them is not decoration — it is the claim that order means
 * something, which is the claim the prompt makes.
 *
 * Nothing here is rendered until the user asks for it. An automatic second request
 * would spend a credit on advice about a score they have not read yet.
 */

import { Lightbulb, Sparkles, ThumbsUp, TriangleAlert } from "lucide-react";

import { AiFailureNotice, type AiActionFailure } from "@/features/ai";
import { SkeletonText } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import type { JobMatchGapsOutput } from "@/services/ai";
import { cn } from "@/lib/utils";

import type { JobGapsStatus } from "../hooks/use-job-match";
import { GAP_SEVERITIES, GAP_SEVERITY_LABELS, type GapSeverity } from "../schema/job-match-schema";

/** Severity reads as a badge tone. `minor` stays neutral so the list has a floor. */
const SEVERITY_VARIANT: Record<GapSeverity, "destructive" | "secondary" | "outline"> = {
  blocking: "destructive",
  significant: "secondary",
  minor: "outline",
};

const SEVERITY_RULE: Record<GapSeverity, string> = {
  blocking: "border-destructive/40",
  significant: "border-warning/40",
  minor: "border-border/60",
};

export interface JobGapsPanelProps {
  status: JobGapsStatus;
  gaps: JobMatchGapsOutput | null;
  failure: AiActionFailure | null;
  onRetry: () => void;
}

export function JobGapsPanel({ status, gaps, failure, onRetry }: JobGapsPanelProps) {
  if (status === "idle") {
    return null;
  }

  if (status === "loading") {
    return (
      <section className="space-y-2 rounded-lg border border-border/60 p-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Sparkles aria-hidden className="size-3.5" />
          <span role="status">Reading your resume against the posting…</span>
        </p>
        <SkeletonText lines={4} />
      </section>
    );
  }

  if (status === "error") {
    // `failure` is set with the status, but the type does not prove it, and a bare
    // "something failed" box says less than nothing.
    return failure ? <AiFailureNotice failure={failure} onRetry={onRetry} /> : null;
  }

  if (!gaps) {
    return null;
  }

  // Grouped rather than sorted so a severity the model did not use disappears entirely
  // instead of leaving an empty heading.
  const grouped = GAP_SEVERITIES.map((severity) => ({
    severity,
    entries: gaps.gaps.filter((gap) => gap.severity === severity),
  })).filter((group) => group.entries.length > 0);

  return (
    <div className="space-y-5 border-t border-border/60 pt-5">
      {grouped.length > 0 ? (
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <TriangleAlert aria-hidden className="size-3.5" />
            What stands between you and this role
          </h4>

          <ul className="space-y-2">
            {grouped.flatMap((group) =>
              group.entries.map((gap) => (
                <li
                  key={`${group.severity}-${gap.requirement}`}
                  className={cn(
                    "space-y-1 rounded-md border border-l-2 p-2.5",
                    SEVERITY_RULE[group.severity],
                  )}
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-xs font-medium">{gap.requirement}</span>
                    <Badge variant={SEVERITY_VARIANT[group.severity]}>
                      {GAP_SEVERITY_LABELS[group.severity]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{gap.advice}</p>
                </li>
              )),
            )}
          </ul>
        </section>
      ) : null}

      {gaps.strengths.length > 0 ? (
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <ThumbsUp aria-hidden className="size-3.5" />
            Where you are over the bar
          </h4>

          <ul className="space-y-1">
            {gaps.strengths.map((strength) => (
              <li key={strength} className="flex gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-success" />
                {strength}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <Lightbulb aria-hidden className="size-3.5" />
          Do these, in this order
        </h4>

        {/* Ordered because the model ranks them. A bulleted list would throw that away. */}
        <ol className="space-y-1.5">
          {gaps.recommendations.map((recommendation, index) => (
            <li key={recommendation} className="flex gap-2 text-xs">
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.625rem] font-medium text-primary tabular-nums">
                {index + 1}
              </span>
              {recommendation}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
