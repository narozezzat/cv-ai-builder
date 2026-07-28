import type { Metadata } from "next";

import { AsyncBoundary } from "@/components/shared";
import { StatCardsSection, StatCardsSkeleton } from "@/features/dashboard";
import {
  ActivityFeedSection,
  ActivityFeedSkeleton,
  AiCreditsSection,
  AiCreditsSkeleton,
  DashboardGreeting,
  DashboardGreetingSkeleton,
} from "@/features/profile";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your resumes, AI credits, and recent activity.",
  // Signed-in pages must never be indexed, and a canonical URL would invite it.
  robots: { index: false, follow: false },
};

/**
 * The dashboard shell — synchronous on purpose.
 *
 * Nothing here awaits, so the layout, the header, and the grid structure flush on
 * the first byte and each widget streams in behind its own boundary. Awaiting the
 * three reads in the page instead (which is what this used to do) meant the slowest
 * of them — the activity feed, over a table that grows without ceiling — decided
 * when *any* of the page appeared.
 *
 * Each region gets `AsyncBoundary` rather than a bare `Suspense`, so one failed read
 * degrades to a retry card in place instead of taking the whole route to
 * `error.tsx`.
 */
export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <AsyncBoundary pending={<DashboardGreetingSkeleton />}>
        <DashboardGreeting />
      </AsyncBoundary>

      <AsyncBoundary pending={<StatCardsSkeleton />}>
        <StatCardsSection />
      </AsyncBoundary>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Both children span their own columns, and `AsyncBoundary` renders no DOM
            of its own, so the grid still sees them as direct children. */}
        <AsyncBoundary pending={<ActivityFeedSkeleton />}>
          <ActivityFeedSection />
        </AsyncBoundary>

        <AsyncBoundary pending={<AiCreditsSkeleton />}>
          <AiCreditsSection />
        </AsyncBoundary>
      </div>
    </div>
  );
}
