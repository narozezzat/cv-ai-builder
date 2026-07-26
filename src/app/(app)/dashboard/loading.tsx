import { ShimmerSkeleton, SkeletonCard, SkeletonText } from "@/components/shared";

/**
 * Streams while the dashboard's three reads resolve.
 *
 * Mirrors the real page's spacing and grid so the layout doesn't jump when the
 * data lands — a skeleton that reflows is worse than a spinner, because the shift
 * happens exactly when the user has started reading.
 */
export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-label="Loading your dashboard"
      className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10"
    >
      <div className="space-y-2">
        <ShimmerSkeleton className="h-8 w-64" />
        <ShimmerSkeleton className="h-4 w-80" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="grid gap-3 lg:grid-cols-3">
        <div
          aria-hidden
          className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2"
        >
          <ShimmerSkeleton className="h-4 w-36" />
          <SkeletonText lines={5} />
        </div>

        <SkeletonCard />
      </div>
    </div>
  );
}
