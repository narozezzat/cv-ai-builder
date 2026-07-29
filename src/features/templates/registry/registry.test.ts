/**
 * The catalogue's invariants.
 *
 * These are not style opinions — each one is something that breaks a user-visible surface
 * if it drifts. A duplicate id shadows a template in the gallery and makes `getTemplateDefinition`
 * return whichever won the `Map`. A layout id with no component fails to compile, but a
 * category with only one template shows a filter chip that yields a one-item grid. A template
 * with fewer than four palettes contradicts the promise the palette picker makes.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_TEMPLATE_ID, RESUME_FONTS } from "@/types/resume";

import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_LAYOUTS,
  type TemplateCategory,
} from "../lib/template-types";
import { DEFAULT_TEMPLATE, getTemplateDefinition, isKnownTemplateId, TEMPLATES } from "./index";

/** Matches the `id` CHECK constraint on `resume_templates`. */
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const PER_CATEGORY = 2;

describe("TEMPLATES", () => {
  it("ships the full catalogue", () => {
    expect(TEMPLATES).toHaveLength(TEMPLATE_CATEGORIES.length * PER_CATEGORY);
  });

  it("uses ids that are unique and accepted by the database", () => {
    const ids = TEMPLATES.map((template) => template.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const id of ids) {
      expect(id, id).toMatch(ID_PATTERN);
    }
  });

  it("names and describes every template", () => {
    for (const template of TEMPLATES) {
      expect(template.name.trim().length, template.id).toBeGreaterThan(0);
      // The description is the only copy in the gallery card, so an empty one leaves a
      // template indistinguishable from its sibling in the same category.
      expect(template.description.trim().length, template.id).toBeGreaterThan(20);
    }
  });

  it("names a layout that exists", () => {
    for (const template of TEMPLATES) {
      expect(TEMPLATE_LAYOUTS, template.id).toContain(template.layout);
    }
  });

  it("fills both slots in every category", () => {
    const counts = new Map<TemplateCategory, number>();

    for (const template of TEMPLATES) {
      counts.set(template.category, (counts.get(template.category) ?? 0) + 1);
    }

    for (const category of TEMPLATE_CATEGORIES) {
      expect(counts.get(category), category).toBe(PER_CATEGORY);
    }
  });

  it("offers at least four palettes, with no repeats inside a template", () => {
    for (const template of TEMPLATES) {
      expect(template.palettes.length, template.id).toBeGreaterThanOrEqual(4);

      const ids = template.palettes.map((palette) => palette.id);
      expect(new Set(ids).size, template.id).toBe(ids.length);
    }
  });

  it("only uses fonts the app actually loads", () => {
    for (const { id, tokens } of TEMPLATES) {
      expect(RESUME_FONTS, `${id}.headingFont`).toContain(tokens.headingFont);
      expect(RESUME_FONTS, `${id}.bodyFont`).toContain(tokens.bodyFont);
    }
  });

  /**
   * Scales multiply the resolved body size. A zero or a negative collapses or inverts the
   * text, and anything past ~3 pushes the name off the page — neither is caught by types.
   */
  it("keeps every scale and the density inside a printable range", () => {
    for (const { id, tokens } of TEMPLATES) {
      for (const key of ["nameScale", "headlineScale", "sectionTitleScale"] as const) {
        expect(tokens[key], `${id}.${key}`).toBeGreaterThan(0.5);
        expect(tokens[key], `${id}.${key}`).toBeLessThanOrEqual(3);
      }

      expect(tokens.density, `${id}.density`).toBeGreaterThanOrEqual(0.85);
      expect(tokens.density, `${id}.density`).toBeLessThanOrEqual(1.25);
    }
  });

  /**
   * The sidebar clamp in `layout-shared.ts` will rein in an out-of-range width silently, so
   * assert the authored value too — a template asking for 60% is a mistake, not a preference.
   */
  it("keeps sidebar widths within the range the layout supports", () => {
    for (const { id, tokens } of TEMPLATES) {
      if (tokens.asideWidthPct === undefined) continue;

      expect(tokens.asideWidthPct, `${id}.asideWidthPct`).toBeGreaterThanOrEqual(26);
      expect(tokens.asideWidthPct, `${id}.asideWidthPct`).toBeLessThanOrEqual(42);
    }
  });

  /** Tokens only the sidebar layouts read are noise anywhere else, and imply a copy/paste. */
  it("only sets layout-specific tokens on the layouts that read them", () => {
    for (const { id, layout, tokens } of TEMPLATES) {
      const isSidebar = layout === "sidebar-left" || layout === "sidebar-right";

      if (!isSidebar) {
        expect(tokens.asideWidthPct, `${id}.asideWidthPct`).toBeUndefined();
        expect(tokens.asideFill, `${id}.asideFill`).toBeUndefined();
      }

      if (layout !== "header-banner") {
        expect(tokens.bannerFill, `${id}.bannerFill`).toBeUndefined();
      }
    }
  });

  /** Uppercase without tracking sets solid; the pairing is a legibility floor, not taste. */
  it("tracks out uppercase section titles", () => {
    for (const { id, tokens } of TEMPLATES) {
      if (!tokens.uppercaseSectionTitles) continue;

      expect(tokens.sectionTitleTracking, `${id}.sectionTitleTracking`).toBeGreaterThanOrEqual(
        0.04,
      );
    }
  });
});

describe("getTemplateDefinition", () => {
  it("returns the template for a known id", () => {
    for (const template of TEMPLATES) {
      expect(getTemplateDefinition(template.id)).toBe(template);
    }
  });

  /**
   * The reason lookups do not throw: `resumes.template_id` is text with no foreign key to
   * the registry, so a retired or hand-edited id must still open the resume.
   */
  it("falls back to the default for an unknown id", () => {
    expect(getTemplateDefinition("does-not-exist")).toBe(DEFAULT_TEMPLATE);
    expect(getTemplateDefinition("")).toBe(DEFAULT_TEMPLATE);
  });
});

describe("DEFAULT_TEMPLATE", () => {
  /** The schema default and the seeded row both name this id; a mismatch is a broken insert. */
  it("is the id the resume schema defaults to", () => {
    expect(DEFAULT_TEMPLATE.id).toBe(DEFAULT_TEMPLATE_ID);
    expect(isKnownTemplateId(DEFAULT_TEMPLATE_ID)).toBe(true);
  });
});
