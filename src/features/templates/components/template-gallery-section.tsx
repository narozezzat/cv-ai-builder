import { ShimmerSkeleton } from "@/components/shared";

import { filterTemplates } from "../lib/gallery";
import { TEMPLATES } from "../registry";
import { getActiveTemplateIds, getFavoriteTemplateIds } from "../queries/template-queries";
import { type TemplateGalleryFilters } from "../schema/template-schema";

import { TemplateGallery } from "./template-gallery";

interface TemplateGallerySectionProps {
  filters: TemplateGalleryFilters;
}

/**
 * The grid, with the two reads it depends on.
 *
 * Both queries are `cache`d, so the filter bar above asking for the same two sets costs
 * one round-trip between them rather than two — which is why the counts on the chips and
 * the cards in the grid can never disagree about what is starred.
 */
export async function TemplateGallerySection({ filters }: TemplateGallerySectionProps) {
  const [favorites, activeIds] = await Promise.all([
    getFavoriteTemplateIds(),
    getActiveTemplateIds(),
  ]);

  const templates = filterTemplates({ templates: TEMPLATES, filters, favorites, activeIds });

  return <TemplateGallery templates={templates} filters={filters} />;
}

/**
 * Six gallery cards, thumbnail-shaped.
 *
 * Not `SkeletonCard`: that one is an avatar and two lines of prose, and a template card is
 * two thirds of an A4 page above a short body — roughly a 320:299 box. Substituting the
 * short card would collapse the grid to a third of its height and then push it back down
 * as the real thing arrives.
 */
export function TemplateGallerySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading templates"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          aria-hidden
          className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-xs"
        >
          <ShimmerSkeleton className="aspect-[320/299] w-full rounded-none" />
          <div className="space-y-3 p-4">
            <ShimmerSkeleton className="h-3.5 w-1/2" />
            <ShimmerSkeleton className="h-3 w-full" />
            <ShimmerSkeleton className="h-3 w-16 rounded-full" />
            <ShimmerSkeleton className="h-8 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
