import { ActivityIcon } from "lucide-react";

import { SectionCard, ShimmerSkeleton, SkeletonText } from "@/components/shared";

import { getRecentActivity } from "../queries/profile-queries";
import { ActivityFeed } from "./activity-feed";

/** How many rows the dashboard panel shows. The feed itself is unbounded. */
const DASHBOARD_ACTIVITY_LIMIT = 6;

/**
 * The recent-activity panel, including its own read.
 *
 * `activity_logs` grows without ceiling and is the slowest of the dashboard's three
 * reads, so it is the one that most needs its own boundary: the counters and the
 * credits card should not wait behind it.
 */
export async function ActivityFeedSection() {
  const items = await getRecentActivity(DASHBOARD_ACTIVITY_LIMIT);

  return (
    <SectionCard
      className="lg:col-span-2"
      icon={ActivityIcon}
      title="Recent activity"
      description="The last few things that happened on your account."
    >
      <ActivityFeed items={items} />
    </SectionCard>
  );
}

/** Matches `SectionCard`'s chrome and column span, title line included. */
export function ActivityFeedSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading recent activity"
      className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2"
    >
      <ShimmerSkeleton className="h-4 w-36" />
      <SkeletonText lines={5} />
    </div>
  );
}
