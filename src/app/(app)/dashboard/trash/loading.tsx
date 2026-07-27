import { ShimmerSkeleton } from "@/components/shared";

/** Streams while the trashed rows load. Row heights match `TrashList`'s. */
export default function TrashLoading() {
  return (
    <div
      role="status"
      aria-label="Loading the trash"
      className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6 sm:py-10"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <ShimmerSkeleton className="h-4 w-32" />
          <ShimmerSkeleton className="h-8 w-28" />
          <ShimmerSkeleton className="h-4 w-80" />
        </div>
        <ShimmerSkeleton aria-hidden className="h-9 w-32 rounded-lg" />
      </div>

      <div
        aria-hidden
        className="divide-y divide-border/60 overflow-hidden rounded-xl ring-1 ring-foreground/5"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 bg-card px-4 py-3">
            <div className="flex-1 space-y-2">
              <ShimmerSkeleton className="h-4 w-52" />
              <ShimmerSkeleton className="h-3 w-24" />
            </div>
            <ShimmerSkeleton className="h-8 w-24 rounded-lg" />
            <ShimmerSkeleton className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
