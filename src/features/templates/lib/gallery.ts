/**
 * The gallery's selection logic, as a pure function.
 *
 * Kept out of the page component on purpose: "which templates does this user see" is the
 * one piece of the gallery that can be wrong in a way nobody notices — a kill switch that
 * does not switch anything off, or a favourites filter that quietly hides an active
 * template. A function over three plain inputs is testable; the same logic inlined in a
 * Server Component is only testable by rendering it.
 */

import type { TemplateGalleryFilters } from "../schema/template-schema";
import {
  TEMPLATE_CATEGORY_LABELS,
  type TemplateCategory,
  type TemplateDefinition,
} from "./template-types";

export interface GalleryTemplate {
  definition: TemplateDefinition;
  isFavorite: boolean;
}

export interface FilterTemplatesInput {
  /** Registry order — the designed order, which is also the gallery's default sort. */
  templates: readonly TemplateDefinition[];
  filters: TemplateGalleryFilters;
  favorites: ReadonlySet<string>;
  /**
   * Ids `resume_templates.is_active` allows, or `null` when the catalogue could not be
   * read. `null` means "unknown" and lets everything through — see `getActiveTemplateIds`
   * for why an empty gallery is the worse failure.
   */
  activeIds: ReadonlySet<string> | null;
}

/** Case- and diacritic-insensitive, so "Élégant" matches a plain "elegant". */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function matchesSearch(definition: TemplateDefinition, needle: string): boolean {
  const haystack = normalize(
    `${definition.name} ${definition.description} ${TEMPLATE_CATEGORY_LABELS[definition.category]}`,
  );

  // Every whitespace-separated term must appear somewhere. "minimal serif" should find a
  // template whose name and description each supply one word, which a substring match of
  // the whole query would miss.
  return normalize(needle)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

/**
 * Registry ∩ catalogue, then the user's filters. Favourites are attached rather than
 * looked up per card so the grid stays a dumb map over the result.
 */
export function filterTemplates({
  templates,
  filters,
  favorites,
  activeIds,
}: FilterTemplatesInput): GalleryTemplate[] {
  return templates
    .filter((definition) => activeIds === null || activeIds.has(definition.id))
    .filter((definition) => filters.category === "" || definition.category === filters.category)
    .filter((definition) => !filters.favorites || favorites.has(definition.id))
    .filter((definition) => filters.q === "" || matchesSearch(definition, filters.q))
    .map((definition) => ({ definition, isFavorite: favorites.has(definition.id) }));
}

export interface GalleryCategoryOption {
  /**
   * A registry category, not a loose string: the chips write this straight into the
   * filters, which only accept a category the schema knows.
   */
  value: TemplateCategory;
  label: string;
  count: number;
}

/**
 * Category chips with counts.
 *
 * Counted against the *active* catalogue but before the category and search filters, so
 * the numbers describe what picking a chip would show rather than what is on screen —
 * a chip reading "Tech 3" that yields nothing is a bug report waiting to happen.
 * Favourites-only is applied, because it is a mode rather than a filter within the grid.
 */
export function galleryCategoryOptions({
  templates,
  filters,
  favorites,
  activeIds,
}: FilterTemplatesInput): GalleryCategoryOption[] {
  const counts = new Map<string, number>();

  for (const definition of templates) {
    if (activeIds !== null && !activeIds.has(definition.id)) continue;
    if (filters.favorites && !favorites.has(definition.id)) continue;

    counts.set(definition.category, (counts.get(definition.category) ?? 0) + 1);
  }

  // Registry order again, not alphabetical: the categories are ordered by how a job
  // seeker is expected to browse them, and re-sorting here would undo that.
  const seen = new Set<string>();
  const options: GalleryCategoryOption[] = [];

  for (const definition of templates) {
    if (seen.has(definition.category)) continue;
    seen.add(definition.category);

    const count = counts.get(definition.category) ?? 0;

    if (count === 0) continue;

    options.push({
      value: definition.category,
      label: TEMPLATE_CATEGORY_LABELS[definition.category],
      count,
    });
  }

  return options;
}
