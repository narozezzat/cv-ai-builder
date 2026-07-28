import { ShimmerSkeleton } from "@/components/shared";
import { getDashboardStats } from "@/features/profile";

import { StatCards } from "./stat-cards";

/**
 * The counters, fetching their own data so the dashboard shell can flush before
 * `get_dashboard_stats` returns.
 *
 * The read lives here rather than in the page because a page that awaits it is a
 * page whose first byte waits on the slowest aggregate on the account. `StatCards`
 * stays a pure presentational component, which is what makes it testable.
 */
export async function StatCardsSection() {
  const stats = await getDashboardStats();

  return <StatCards stats={stats} />;
}

/**
 * Four card outlines at the real grid's spacing.
 *
 * Exported next to the section it stands in for, so the fallback and the content
 * cannot drift into different sizes — a skeleton that reflows on arrival shifts the
 * page exactly when the user has started reading it.
 */
export function StatCardsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading your stats"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          aria-hidden
          className="flex items-start justify-between gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
        >
          <div className="flex-1 space-y-2">
            <ShimmerSkeleton className="h-3 w-20" />
            <ShimmerSkeleton className="h-6 w-14" />
          </div>
          <ShimmerSkeleton className="size-8 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
