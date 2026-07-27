import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the editor's real spacing — header bar, basics grid, section rows — so the
 * page does not reflow when the content arrives.
 *
 * `role="status"` with a label, and every shape `aria-hidden`: a screen reader gets
 * one sentence instead of a list of empty boxes.
 */
export default function BuilderLoading() {
  return (
    <div className="flex min-h-svh flex-col" role="status" aria-label="Loading the editor">
      <div className="sticky top-0 z-40 border-b border-border/60 bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-3 sm:px-6">
          <Skeleton aria-hidden className="h-8 w-24" />
          <Skeleton aria-hidden className="h-8 flex-1" />
          <Skeleton aria-hidden className="h-8 w-20" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-3 py-6 sm:px-6">
        <div className="space-y-3">
          <Skeleton aria-hidden className="h-4 w-16" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-1.5">
                <Skeleton aria-hidden className="h-3 w-20" />
                <Skeleton aria-hidden className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Skeleton aria-hidden className="h-4 w-20" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton aria-hidden key={index} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
