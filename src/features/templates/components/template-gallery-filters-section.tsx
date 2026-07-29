import { ShimmerSkeleton } from "@/components/shared";

import { galleryCategoryOptions } from "../lib/gallery";
import { TEMPLATES } from "../registry";
import { getActiveTemplateIds, getFavoriteTemplateIds } from "../queries/template-queries";
import { type TemplateGalleryFilters } from "../schema/template-schema";

import { TemplateGalleryFilters as TemplateGalleryFiltersBar } from "./template-gallery-filters";

interface TemplateGalleryFiltersSectionProps {
  filters: TemplateGalleryFilters;
}

/**
 * The controls, streamed because the chip counts depend on the user's favourites and on
 * which templates the catalogue still has switched on.
 *
 * Its boundary must not be keyed on the filters — remounting this would unmount the search
 * input mid-keystroke and take the caret with it.
 */
export async function TemplateGalleryFiltersSection({
  filters,
}: TemplateGalleryFiltersSectionProps) {
  const [favorites, activeIds] = await Promise.all([
    getFavoriteTemplateIds(),
    getActiveTemplateIds(),
  ]);

  const categories = galleryCategoryOptions({
    templates: TEMPLATES,
    filters,
    favorites,
    activeIds,
  });

  return <TemplateGalleryFiltersBar filters={filters} categories={categories} />;
}

/** Search box and the favourites toggle, then a row of chips at chip height. */
export function TemplateGalleryFiltersSkeleton() {
  return (
    <div role="status" aria-label="Loading filters" className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <ShimmerSkeleton className="h-9 w-full rounded-full sm:max-w-xs" />
        <ShimmerSkeleton className="h-9 w-32 rounded-lg sm:ml-auto" />
      </div>
      {/* Widths vary because the real chips are category names of different lengths; a row
          of identical pills reads as a component, not as loading content. */}
      <div className="flex flex-wrap gap-1.5">
        {["w-14", "w-20", "w-18", "w-24", "w-16", "w-22", "w-18"].map((width, index) => (
          <ShimmerSkeleton key={index} className={`h-6 rounded-full ${width}`} />
        ))}
      </div>
    </div>
  );
}
