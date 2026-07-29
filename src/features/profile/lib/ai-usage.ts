/**
 * Reading the AI usage ledger: labels for what was run, and the month's rollup.
 *
 * None of this imports `@/services/ai`. That module tree is `server-only`, and the
 * two things this file needs from it — the capability ids and the error copy — would
 * drag the provider registry into any client component rendering a ledger row. So
 * both are restated here, keyed on the same free-text strings the columns hold.
 *
 * `ai_usage.capability` and `ai_usage.error_code` are text, not enums, for the same
 * reason `activity_logs.action` is: a ledger that rejects unknown values stops
 * recording the day a new capability ships. The cost is paid in `capabilityLabel`,
 * which degrades instead of showing nothing — see [activityLabel](./activity.ts).
 */

import type { AiUsageEntry } from "@/types/db";

/** Mirrors the ids in `AI_CAPABILITIES`. Renaming one there orphans its history. */
const CAPABILITY_LABELS: Record<string, string> = {
  "summary.generate": "Summary generated",
  "experience.rewrite": "Experience rewritten",
  "bullets.improve": "Bullets improved",
  "bullets.fromParagraph": "Paragraph turned into bullets",
  "achievements.suggest": "Achievements suggested",
  "skills.suggest": "Skills suggested",
  "projects.suggest": "Projects suggested",
  "keywords.generate": "Keywords generated",
  "jobTitles.suggest": "Job titles suggested",
  "text.grammar": "Grammar and spelling fixed",
  "text.atsRewrite": "Rewritten for ATS",
  "text.tailorToCompany": "Tailored to a company",
  "coverLetter.generate": "Cover letter written",
  "jobMatch.extract": "Job posting scored",
  "jobMatch.gaps": "Gaps explained",
};

/** `resume.polish` → "Resume polish". Names what ran, which beats an empty cell. */
function humanize(capability: string): string {
  const words = capability
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]/g, " ")
    .trim()
    .toLowerCase();

  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function capabilityLabel(capability: string): string {
  return CAPABILITY_LABELS[capability] ?? humanize(capability);
}

/**
 * Why a metered call failed, in a few words.
 *
 * Shorter than `AI_ERROR_MESSAGES`, which is written as recovery advice for the
 * moment of failure. On a past row there is nothing left to recover — the user is
 * reading why a credit went nowhere.
 *
 * `rate_limited`, `insufficient_credits`, `unauthenticated`, and `not_configured`
 * are here for completeness only: `guardAiRequest` throws those before anything is
 * charged, so they never reach the ledger.
 */
const FAILURE_LABELS: Record<string, string> = {
  provider_unavailable: "Provider unavailable",
  invalid_output: "Unusable result",
  invalid_input: "Rejected input",
  timeout: "Timed out",
  aborted: "Cancelled",
  rate_limited: "Rate limited",
  insufficient_credits: "Out of credits",
  unauthenticated: "Not signed in",
  not_configured: "AI not configured",
  unknown: "Failed",
};

export function failureLabel(errorCode: string | null): string {
  if (!errorCode) return "Failed";

  return FAILURE_LABELS[errorCode] ?? "Failed";
}

/**
 * First instant of `now`'s month, as an ISO string for a `created_at >= …` filter.
 *
 * UTC, matching `timestamptz` storage and the monthly credit reset, rather than the
 * viewer's zone — a rollup that shifts when the user travels is a support ticket.
 * `now` is injected so tests are not time-dependent.
 */
export function startOfMonthIso(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export interface AiUsageSummary {
  /** Credits actually deducted, failures included — they were charged too. */
  creditsSpent: number;
  calls: number;
  failures: number;
  /** `null` token counts (failures, providers that report nothing) count as zero. */
  tokens: number;
  costUsd: number;
}

/**
 * The period rollup, computed here rather than in SQL.
 *
 * Safe because the row count is bounded by credits spent: every ledger row charges
 * at least one credit, and guard rejections never write a row at all. A month's
 * worth is tens of rows, so a `sum()` RPC would buy nothing and cost a migration.
 */
export function summarizeAiUsage(rows: readonly AiUsageEntry[]): AiUsageSummary {
  return rows.reduce<AiUsageSummary>(
    (summary, row) => ({
      creditsSpent: summary.creditsSpent + row.credits_charged,
      calls: summary.calls + 1,
      failures: summary.failures + (row.success ? 0 : 1),
      tokens: summary.tokens + (row.total_tokens ?? 0),
      costUsd: summary.costUsd + row.cost_usd,
    }),
    { creditsSpent: 0, calls: 0, failures: 0, tokens: 0, costUsd: 0 },
  );
}
