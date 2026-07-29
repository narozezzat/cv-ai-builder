/**
 * Builds the gallery URL from a filter patch — the write half of the URL-as-state
 * arrangement described in `template-schema.ts`.
 *
 * Defaults are omitted rather than serialised, so the unfiltered gallery is a clean
 * `/dashboard/templates` and `parseTemplateGalleryFilters` fills the rest in.
 */

import { routes } from "@/lib/routes";

import type { TemplateGalleryFilters } from "../schema/template-schema";

export function templateGalleryHref(
  filters: TemplateGalleryFilters,
  patch: Partial<TemplateGalleryFilters> = {},
): string {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();

  if (next.q.length > 0) {
    params.set("q", next.q);
  }

  if (next.category.length > 0) {
    params.set("category", next.category);
  }

  if (next.favorites) {
    params.set("favorites", "1");
  }

  const query = params.toString();

  return query.length > 0 ? `${routes.templateGallery}?${query}` : routes.templateGallery;
}
