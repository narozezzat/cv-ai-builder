import { StatCardsSkeleton } from "@/features/dashboard";
import {
  ActivityFeedSkeleton,
  AiCreditsSkeleton,
  DashboardGreetingSkeleton,
} from "@/features/profile";

/**
 * Covers the navigation into this segment, before the page's shell flushes.
 *
 * Composed from the very skeletons each streamed section falls back to, so the
 * route-level and widget-level loading states are the same pixels by construction
 * — a hand-copied duplicate here would drift the first time a card's padding
 * changed, and the drift would show up as a reflow mid-load.
 *
 * No outer `role="status"`: each skeleton is its own live region with its own
 * label, and nesting them would let one announcement swallow the rest.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <DashboardGreetingSkeleton />
      <StatCardsSkeleton />

      <div className="grid gap-3 lg:grid-cols-3">
        <ActivityFeedSkeleton />
        <AiCreditsSkeleton />
      </div>
    </div>
  );
}
