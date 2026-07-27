import { ShimmerSkeleton, SkeletonCard } from "@/components/shared";

/**
 * Streams while the list's five reads resolve. Mirrors the real page's two-column
 * grid and card sizing so nothing reflows when the data lands.
 */
export default function ResumesLoading() {
  return (
    <div
      role="status"
      aria-label="Loading your resumes"
      className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <ShimmerSkeleton className="h-8 w-40" />
          <ShimmerSkeleton className="h-4 w-72" />
        </div>
        <div aria-hidden className="flex gap-2">
          <ShimmerSkeleton className="h-9 w-24 rounded-lg" />
          <ShimmerSkeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <div aria-hidden className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <ShimmerSkeleton key={index} className="h-8 w-full rounded-md" />
          ))}
        </div>

        <div className="min-w-0 space-y-4">
          <div aria-hidden className="flex flex-col gap-2 sm:flex-row">
            <ShimmerSkeleton className="h-9 w-full rounded-lg sm:max-w-xs" />
            <ShimmerSkeleton className="h-9 w-32 rounded-lg" />
            <ShimmerSkeleton className="h-9 w-32 rounded-lg" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
