import { ClockIcon, DownloadIcon, FileTextIcon, SparklesIcon } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { AnimatedNumber } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { FREE_MONTHLY_AI_CREDITS } from "@/features/profile";
import type { DashboardStats } from "@/types/db";
import { formatDateTime, formatRelativeTime } from "@/utils/date";

interface StatCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  /** Already-formatted display value — a number, a relative time, or an em dash. */
  value: ReactNode;
  /** Secondary line. Omitted rather than rendered empty, so cards stay the same height by grid, not by padding. */
  hint?: string;
  /** Native tooltip for values that are lossy on purpose, e.g. "3 hours ago". */
  title?: string;
}

/**
 * One counter. Local to this file because the four cards differ only in their
 * content — extracting it to `components/shared` would invite unrelated pages to
 * depend on a layout that exists to serve this specific grid.
 */
function StatCard({ icon: Icon, label, value, hint, title }: StatCardProps) {
  return (
    <Card size="sm" className="justify-between">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight" title={title}>
            {value}
          </p>
          {hint ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>

        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 ring-1 ring-foreground/5"
        >
          <Icon className="size-4 text-muted-foreground" />
        </span>
      </CardContent>
    </Card>
  );
}

interface StatCardsProps {
  /** `null` when `get_dashboard_stats` failed or returned an unexpected shape. */
  stats: DashboardStats | null;
}

/**
 * The dashboard's four headline numbers.
 *
 * Renders zeros rather than an error when `stats` is `null`: the counters are
 * context, not the point of the page, and a failed aggregate must not take the
 * resume list down with it. `getDashboardStats` has already logged the reason.
 *
 * A server component — `AnimatedNumber` is the only client piece, and it receives
 * nothing but a number, so the grid itself ships no JavaScript.
 */
export function StatCards({ stats }: StatCardsProps) {
  const resumeCount = stats?.resumeCount ?? 0;
  const trashedCount = stats?.trashedCount ?? 0;
  const downloadCount = stats?.downloadCount ?? 0;
  const aiCredits = stats?.aiCredits ?? 0;
  const lastEditedAt = stats?.lastEditedAt ?? null;

  const lastEdited = lastEditedAt ? formatRelativeTime(lastEditedAt) : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={FileTextIcon}
        label="Resumes"
        value={<AnimatedNumber value={resumeCount} />}
        hint={trashedCount > 0 ? `${trashedCount} in trash` : undefined}
      />

      <StatCard
        icon={DownloadIcon}
        label="Downloads"
        value={<AnimatedNumber value={downloadCount} />}
        hint={downloadCount === 0 ? "Export a resume to get started" : undefined}
      />

      <StatCard
        icon={SparklesIcon}
        label="AI credits"
        value={<AnimatedNumber value={aiCredits} />}
        hint={`of ${Math.max(FREE_MONTHLY_AI_CREDITS, aiCredits)} this month`}
      />

      {/*
        The one non-numeric card. An em dash rather than "Never": a brand-new
        account has nothing to report, and "Never" reads like something went wrong.
        The exact timestamp goes in the tooltip because "3 hours ago" is the
        friendlier reading and the useless one when you need to be precise.
      */}
      <StatCard
        icon={ClockIcon}
        label="Last edited"
        value={lastEdited ?? "—"}
        title={lastEditedAt ? (formatDateTime(lastEditedAt) ?? undefined) : undefined}
      />
    </div>
  );
}
