import { ShimmerSkeleton } from "@/components/shared";
import { FolderNavSkeleton, ResumeFiltersSkeleton, ResumeGridSkeleton } from "@/features/resume";

/**
 * Covers the navigation into this segment. Same skeletons the streamed sections
 * fall back to, in the same grid, so nothing reflows as each one resolves.
 *
 * The header block is hand-built and `aria-hidden`: the real `PageHeader` renders
 * static text, so it has no skeleton of its own, and the three regions below
 * already announce that the page is loading.
 */
export default function ResumesLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div aria-hidden className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <ShimmerSkeleton className="h-8 w-40" />
          <ShimmerSkeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <ShimmerSkeleton className="h-9 w-24 rounded-lg" />
          <ShimmerSkeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <FolderNavSkeleton />

        <div className="min-w-0 space-y-4">
          <ResumeFiltersSkeleton />
          <ResumeGridSkeleton />
        </div>
      </div>
    </div>
  );
}
