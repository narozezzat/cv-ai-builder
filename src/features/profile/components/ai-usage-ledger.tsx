import { SparklesIcon, TriangleAlertIcon } from "lucide-react";

import { EmptyState, SectionCard } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import type { AiUsageEntry } from "@/types/db";
import { formatDateTime, formatRelativeTime } from "@/utils/date";

import { capabilityLabel, failureLabel, summarizeAiUsage } from "../lib/ai-usage";

/** Rows shown before the list is cut. The rollup above it still counts every row. */
const VISIBLE_ROWS = 12;

export interface AiUsageLedgerProps {
  /** This month's rows, newest first — see `getMonthlyAiUsage`. */
  rows: AiUsageEntry[];
  /** True when the month exceeded the query cap, so the totals are a floor. */
  truncated?: boolean;
}

/**
 * Where the month's credits went.
 *
 * Exists because a balance alone is not accountable: "12 credits left" invites
 * "left from what, spent on what?", and the only honest answer is the ledger the
 * runner already writes. Failures are listed rather than hidden — a credit was
 * charged for each one, so omitting them would make the totals look wrong.
 */
export function AiUsageLedger({ rows, truncated = false }: AiUsageLedgerProps) {
  const summary = summarizeAiUsage(rows);
  const visible = rows.slice(0, VISIBLE_ROWS);
  const hidden = rows.length - visible.length;

  return (
    <SectionCard
      icon={SparklesIcon}
      title="Credits this month"
      description="Every AI request is recorded here, including the ones that failed — those are charged too."
    >
      {rows.length === 0 ? (
        <EmptyState
          size="compact"
          icon={SparklesIcon}
          title="No credits spent this month"
          description="Generate a summary or score a job posting and it will show up here."
        />
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Credits spent"
              value={summary.creditsSpent.toLocaleString()}
              approximate={truncated}
            />
            <Stat label="Requests" value={summary.calls.toLocaleString()} approximate={truncated} />
            <Stat
              label="Failed"
              value={summary.failures.toLocaleString()}
              approximate={truncated}
            />
            <Stat
              label="Tokens"
              value={summary.tokens.toLocaleString()}
              approximate={truncated}
              // Token counts are the provider's, and a failed call reports none.
              hint="Prompt and completion combined, where the provider reported them."
            />
          </dl>

          <ol className="-my-1 divide-y divide-border/60">
            {visible.map((row) => (
              <LedgerRow key={row.id} row={row} />
            ))}
          </ol>

          {hidden > 0 ? (
            <p className="text-xs text-muted-foreground">
              {hidden.toLocaleString()} earlier {hidden === 1 ? "request" : "requests"} this month
              {truncated ? " (and more beyond what is loaded)" : ""} — the totals above include
              {truncated ? " every loaded row" : " all of them"}.
            </p>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}

function Stat({
  label,
  value,
  hint,
  approximate,
}: {
  label: string;
  value: string;
  hint?: string;
  approximate: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums" title={hint}>
        {approximate ? `${value}+` : value}
      </dd>
    </div>
  );
}

/**
 * One request. The exact timestamp is in `title` for the same reason the activity
 * feed carries it: "2 hours ago" reads better but cannot be reconciled against a
 * balance.
 */
function LedgerRow({ row }: { row: AiUsageEntry }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 ring-1 ring-foreground/5"
      >
        {row.success ? (
          <SparklesIcon className="size-3.5 text-muted-foreground" />
        ) : (
          <TriangleAlertIcon className="size-3.5 text-warning" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{capabilityLabel(row.capability)}</p>
        {row.success ? null : (
          <Badge variant="secondary" className="mt-1 text-[0.6875rem]">
            {failureLabel(row.error_code)}
          </Badge>
        )}
      </div>

      <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        {row.credits_charged.toLocaleString()}
        <span className="sr-only"> credits</span>
        <span aria-hidden> cr</span>
      </span>

      <time
        dateTime={row.created_at}
        title={formatDateTime(row.created_at) ?? undefined}
        className="w-20 shrink-0 text-right text-xs whitespace-nowrap text-muted-foreground"
      >
        {formatRelativeTime(row.created_at)}
      </time>
    </li>
  );
}
