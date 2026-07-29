import { describe, expect, it } from "vitest";

import { TEMPLATES } from "../registry";
import {
  DEFAULT_TEMPLATE_GALLERY_FILTERS,
  hasActiveTemplateFilters,
  parseTemplateGalleryFilters,
  type TemplateGalleryFilters,
} from "../schema/template-schema";
import { filterTemplates, galleryCategoryOptions } from "./gallery";
import { templateGalleryHref } from "./gallery-url";

const filters = (patch: Partial<TemplateGalleryFilters> = {}): TemplateGalleryFilters => ({
  ...DEFAULT_TEMPLATE_GALLERY_FILTERS,
  ...patch,
});

const ids = (result: ReturnType<typeof filterTemplates>) => result.map((t) => t.definition.id);

describe("filterTemplates", () => {
  it("returns the whole registry, in registry order, when nothing is filtered", () => {
    const result = filterTemplates({
      templates: TEMPLATES,
      filters: filters(),
      favorites: new Set(),
      activeIds: null,
    });

    expect(ids(result)).toEqual(TEMPLATES.map((t) => t.id));
  });

  it("hides templates the catalogue has deactivated", () => {
    const [first, second] = TEMPLATES;

    const result = filterTemplates({
      templates: TEMPLATES,
      filters: filters(),
      favorites: new Set(),
      activeIds: new Set([second.id]),
    });

    expect(ids(result)).toEqual([second.id]);
    expect(ids(result)).not.toContain(first.id);
  });

  // The distinction the query's return type exists for: a failed catalogue read must not
  // empty the gallery.
  it("treats a null catalogue as unknown rather than empty", () => {
    const result = filterTemplates({
      templates: TEMPLATES,
      filters: filters(),
      favorites: new Set(),
      activeIds: null,
    });

    expect(result).toHaveLength(TEMPLATES.length);
  });

  it("keeps only the requested category", () => {
    const category = TEMPLATES[0].category;

    const result = filterTemplates({
      templates: TEMPLATES,
      filters: filters({ category }),
      favorites: new Set(),
      activeIds: null,
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => t.definition.category === category)).toBe(true);
  });

  it("keeps only starred templates in favourites mode, and flags them", () => {
    const starred = TEMPLATES[3].id;

    const result = filterTemplates({
      templates: TEMPLATES,
      filters: filters({ favorites: true }),
      favorites: new Set([starred]),
      activeIds: null,
    });

    expect(ids(result)).toEqual([starred]);
    expect(result[0].isFavorite).toBe(true);
  });

  it("flags favourites outside favourites mode too", () => {
    const starred = TEMPLATES[2].id;

    const result = filterTemplates({
      templates: TEMPLATES,
      filters: filters(),
      favorites: new Set([starred]),
      activeIds: null,
    });

    expect(result.filter((t) => t.isFavorite).map((t) => t.definition.id)).toEqual([starred]);
  });

  it("matches a template by name, ignoring case", () => {
    const target = TEMPLATES[0];

    const result = filterTemplates({
      templates: TEMPLATES,
      filters: filters({ q: target.name.toUpperCase() }),
      favorites: new Set(),
      activeIds: null,
    });

    expect(ids(result)).toContain(target.id);
  });

  it("matches by category label, so searching a style name works", () => {
    const result = filterTemplates({
      templates: TEMPLATES,
      filters: filters({ q: "minimal" }),
      favorites: new Set(),
      activeIds: null,
    });

    expect(result.length).toBeGreaterThan(0);
  });

  // Each term may come from a different field, which a whole-query substring match misses.
  it("requires every search term but not their adjacency", () => {
    const target = TEMPLATES[0];
    const [firstWord] = target.description.split(/\s+/);

    const result = filterTemplates({
      templates: TEMPLATES,
      filters: filters({ q: `${target.name} ${firstWord}` }),
      favorites: new Set(),
      activeIds: null,
    });

    expect(ids(result)).toContain(target.id);
  });

  it("returns nothing for a query that matches nothing", () => {
    const result = filterTemplates({
      templates: TEMPLATES,
      filters: filters({ q: "zzzzquux" }),
      favorites: new Set(),
      activeIds: null,
    });

    expect(result).toEqual([]);
  });

  it("applies filters together, not alternatively", () => {
    const target = TEMPLATES[0];

    const result = filterTemplates({
      templates: TEMPLATES,
      filters: filters({ category: target.category, favorites: true }),
      favorites: new Set([target.id]),
      activeIds: null,
    });

    expect(ids(result)).toEqual([target.id]);
  });
});

describe("galleryCategoryOptions", () => {
  it("counts every category in the registry", () => {
    const options = galleryCategoryOptions({
      templates: TEMPLATES,
      filters: filters(),
      favorites: new Set(),
      activeIds: null,
    });

    expect(options.reduce((sum, option) => sum + option.count, 0)).toBe(TEMPLATES.length);
    expect(new Set(options.map((option) => option.value)).size).toBe(options.length);
  });

  it("ignores the selected category, so counts describe what a chip would show", () => {
    const category = TEMPLATES[0].category;

    const unfiltered = galleryCategoryOptions({
      templates: TEMPLATES,
      filters: filters(),
      favorites: new Set(),
      activeIds: null,
    });
    const selected = galleryCategoryOptions({
      templates: TEMPLATES,
      filters: filters({ category }),
      favorites: new Set(),
      activeIds: null,
    });

    expect(selected).toEqual(unfiltered);
  });

  it("drops categories with nothing left to show", () => {
    const target = TEMPLATES[0];

    const options = galleryCategoryOptions({
      templates: TEMPLATES,
      filters: filters({ favorites: true }),
      favorites: new Set([target.id]),
      activeIds: null,
    });

    expect(options).toEqual([{ value: target.category, label: expect.any(String), count: 1 }]);
  });
});

describe("parseTemplateGalleryFilters", () => {
  it("defaults an empty query string to the full gallery", () => {
    expect(parseTemplateGalleryFilters({})).toEqual(DEFAULT_TEMPLATE_GALLERY_FILTERS);
  });

  it("reads the first value when a key repeats", () => {
    expect(parseTemplateGalleryFilters({ q: ["serif", "sans"] }).q).toBe("serif");
  });

  it("accepts a known category and discards an unknown one", () => {
    expect(parseTemplateGalleryFilters({ category: "tech" }).category).toBe("tech");
    expect(parseTemplateGalleryFilters({ category: "nonsense" }).category).toBe("");
  });

  it("treats 1 and true as favourites-only and anything else as off", () => {
    expect(parseTemplateGalleryFilters({ favorites: "1" }).favorites).toBe(true);
    expect(parseTemplateGalleryFilters({ favorites: "true" }).favorites).toBe(true);
    expect(parseTemplateGalleryFilters({ favorites: "yes" }).favorites).toBe(false);
  });

  it("trims and caps the search term", () => {
    expect(parseTemplateGalleryFilters({ q: "  modern  " }).q).toBe("modern");
    expect(parseTemplateGalleryFilters({ q: "x".repeat(200) }).q).toBe("");
  });

  it("degrades a malformed value instead of throwing", () => {
    expect(() => parseTemplateGalleryFilters({ q: { nope: true } })).not.toThrow();
    expect(parseTemplateGalleryFilters({ q: 42 })).toEqual(DEFAULT_TEMPLATE_GALLERY_FILTERS);
  });
});

describe("hasActiveTemplateFilters", () => {
  it("is false for the default view", () => {
    expect(hasActiveTemplateFilters(DEFAULT_TEMPLATE_GALLERY_FILTERS)).toBe(false);
  });

  it("is true for any single filter", () => {
    expect(hasActiveTemplateFilters(filters({ q: "modern" }))).toBe(true);
    expect(hasActiveTemplateFilters(filters({ category: "tech" }))).toBe(true);
    expect(hasActiveTemplateFilters(filters({ favorites: true }))).toBe(true);
  });
});

describe("templateGalleryHref", () => {
  it("omits defaults so the unfiltered gallery has a clean URL", () => {
    expect(templateGalleryHref(DEFAULT_TEMPLATE_GALLERY_FILTERS)).toBe("/dashboard/templates");
  });

  it("serialises each filter", () => {
    expect(templateGalleryHref(filters({ category: "tech" }))).toBe(
      "/dashboard/templates?category=tech",
    );
    expect(templateGalleryHref(filters({ favorites: true }))).toBe(
      "/dashboard/templates?favorites=1",
    );
  });

  it("encodes a search term", () => {
    expect(templateGalleryHref(filters({ q: "bold & serif" }))).toBe(
      "/dashboard/templates?q=bold+%26+serif",
    );
  });

  it("applies a patch over the current filters", () => {
    const current = filters({ q: "modern", category: "tech" });

    expect(templateGalleryHref(current, { category: "" })).toBe("/dashboard/templates?q=modern");
  });

  // Round-trip: what the chips build must parse back to what built them.
  it("round-trips through the parser", () => {
    const original = filters({ q: "bold serif", category: "elegant", favorites: true });
    const href = templateGalleryHref(original);
    const query = Object.fromEntries(new URL(href, "https://example.test").searchParams);

    expect(parseTemplateGalleryFilters(query)).toEqual(original);
  });
});
