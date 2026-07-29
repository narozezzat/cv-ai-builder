/**
 * Input contracts for the template feature's writes.
 *
 * The only thing crossing the wire is a template id, and it is the interesting case:
 * `template_favorites.template_id` is a foreign key, so an unknown id is rejected by
 * Postgres anyway — but as a 23503 the user would see as a generic failure. Validating
 * against the registry first turns that into a precise message, and keeps a probe for
 * "which template ids exist" from being answered by the difference between two errors.
 */

import { z } from "zod";

import { TEMPLATE_CATEGORIES } from "../lib/template-types";
import { isKnownTemplateId } from "../registry";

/**
 * A registry id, not merely a string that looks like one.
 *
 * `refine` rather than an enum of the twenty ids: the registry is the source of truth,
 * and an enum here would be a second list to update whenever a template ships.
 */
export const templateIdSchema = z
  .string()
  .trim()
  .min(1, "Choose a template.")
  .max(64)
  .refine(isKnownTemplateId, "That template is not available.");

export const templateTargetSchema = z.object({
  templateId: templateIdSchema,
});

export const toggleTemplateFavoriteSchema = z.object({
  templateId: templateIdSchema,
  /**
   * The state the user wants, not a "flip it" instruction. A toggle that reads the
   * current row first would double-write on a fast double-click and land on whichever
   * order the round-trips happened to resolve in; an explicit target is idempotent.
   */
  isFavorite: z.boolean(),
});

export type TemplateTargetInput = z.infer<typeof templateTargetSchema>;
export type ToggleTemplateFavoriteInput = z.infer<typeof toggleTemplateFavoriteSchema>;

// ── Gallery filters ───────────────────────────────────────────────────────────
//
// The gallery's filter state lives in the URL and nowhere else, for the same reason
// the resume grid's does: the page is a Server Component that reads `searchParams`,
// so the URL *is* the state — shareable, bookmarkable, and restored by the back
// button. See `gallery-url.ts` for the other half.

export const TEMPLATE_SEARCH_MAX = 60;

/** Reads one query-string value. `?q=a&q=b` is something anyone can type. */
function firstParam(value: unknown): string {
  if (Array.isArray(value)) {
    const [first] = value;

    return typeof first === "string" ? first : "";
  }

  return typeof value === "string" ? value : "";
}

const param = <TSchema extends z.ZodType>(schema: TSchema) => z.preprocess(firstParam, schema);

/**
 * Every field carries `.catch()`, so a hand-edited URL degrades to the full gallery
 * rather than throwing. Nothing here reaches a database predicate — the filtering is
 * done in memory against the registry — but a template picker that refuses to render
 * because of a stale bookmark is still the wrong failure.
 */
export const templateGalleryFiltersSchema = z.object({
  q: param(z.string().trim().max(TEMPLATE_SEARCH_MAX).catch("")),
  category: param(z.enum(TEMPLATE_CATEGORIES).or(z.literal("")).catch("")),
  favorites: param(
    z
      .enum(["1", "true"])
      .transform(() => true)
      .catch(false),
  ),
});

export type TemplateGalleryFilters = z.infer<typeof templateGalleryFiltersSchema>;

export const DEFAULT_TEMPLATE_GALLERY_FILTERS: TemplateGalleryFilters = {
  q: "",
  category: "",
  favorites: false,
};

/** True when the gallery is filtered — the difference between "none" and "no matches". */
export function hasActiveTemplateFilters(filters: TemplateGalleryFilters): boolean {
  return filters.q.length > 0 || filters.category.length > 0 || filters.favorites;
}

export function parseTemplateGalleryFilters(input: unknown): TemplateGalleryFilters {
  const parsed = templateGalleryFiltersSchema.safeParse(input ?? {});

  return parsed.success ? parsed.data : DEFAULT_TEMPLATE_GALLERY_FILTERS;
}
