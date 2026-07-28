import { ShimmerSkeleton } from "@/components/shared";
import { EmptyTrashSkeleton, TrashListSkeleton } from "@/features/resume";

/**
 * Covers the navigation into this segment, using the same skeletons the streamed
 * sections fall back to. The header block is `aria-hidden` — its real content is
 * static text, and `TrashListSkeleton` already announces the load.
 */
export default function TrashLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div aria-hidden className="space-y-2">
          <ShimmerSkeleton className="h-4 w-32" />
          <ShimmerSkeleton className="h-8 w-28" />
          <ShimmerSkeleton className="h-4 w-80" />
        </div>
        <EmptyTrashSkeleton />
      </div>

      <TrashListSkeleton />
    </div>
  );
}
