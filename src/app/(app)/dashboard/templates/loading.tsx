import { ShimmerSkeleton } from "@/components/shared";
import {
  TemplateGalleryFiltersSkeleton,
  TemplateGallerySkeleton,
} from "@/features/templates/server";

/**
 * Covers the navigation into this segment. Same skeletons the streamed sections fall back
 * to, in the same order, so nothing reflows as each one resolves.
 *
 * The header block is hand-built and `aria-hidden`: `PageHeader` renders static text, so it
 * has no skeleton of its own, and the two regions below already announce the load.
 */
export default function TemplatesLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div aria-hidden className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <ShimmerSkeleton className="h-8 w-44" />
          <ShimmerSkeleton className="h-4 w-80" />
        </div>
        <ShimmerSkeleton className="h-9 w-32 rounded-lg" />
      </div>

      <TemplateGalleryFiltersSkeleton />
      <TemplateGallerySkeleton />
    </div>
  );
}
