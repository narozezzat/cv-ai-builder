/**
 * `resolveTemplate` is the single place where paper, type, and theme become numbers, so
 * these tests pin the unit conversions (a wrong `MM_TO_PX` is a PDF that prints at the
 * wrong size), the precedence rules, and the accent re-validation — which is a security
 * control, not a cosmetic one: that string is interpolated into inline CSS.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_TEMPLATE_ID,
  PAGE_DIMENSIONS_MM,
  RESUME_PAGE_DEFAULTS,
  RESUME_THEME_DEFAULTS,
  type ResumePage,
  type ResumeTheme,
} from "@/types/resume";

import { DEFAULT_TEMPLATE, isKnownTemplateId } from "../registry";
import { MM_TO_PX, PT_TO_PX, mmToPx, ptToPx, resolveTemplate } from "./resolve-template";

function theme(patch: Partial<ResumeTheme> = {}): ResumeTheme {
  return { ...RESUME_THEME_DEFAULTS, ...patch };
}

function page(patch: Partial<ResumePage> = {}): ResumePage {
  return { ...RESUME_PAGE_DEFAULTS, ...patch };
}

function resolve(themePatch: Partial<ResumeTheme> = {}, pagePatch: Partial<ResumePage> = {}) {
  return resolveTemplate({
    templateId: DEFAULT_TEMPLATE_ID,
    theme: theme(themePatch),
    page: page(pagePatch),
  });
}

describe("unit conversion", () => {
  it("uses the CSS definitions of the inch", () => {
    expect(MM_TO_PX).toBeCloseTo(3.7795, 4);
    expect(PT_TO_PX).toBeCloseTo(1.3333, 4);
    expect(mmToPx(25.4)).toBeCloseTo(96, 6);
    expect(ptToPx(72)).toBeCloseTo(96, 6);
  });
});

describe("the default template id", () => {
  /*
    The column default in `resumes.template_id` is this literal. If it ever stops
    resolving to a real registry entry, every new resume silently opens in whatever
    `TEMPLATES[0]` happens to be — a fallback that hides the mistake instead of failing.
  */
  it("resolves to a real registry entry", () => {
    expect(isKnownTemplateId(DEFAULT_TEMPLATE_ID)).toBe(true);
    expect(DEFAULT_TEMPLATE.id).toBe(DEFAULT_TEMPLATE_ID);
  });

  it("falls back to the default for an unknown id rather than throwing", () => {
    const resolved = resolveTemplate({
      templateId: "retired-two-releases-ago",
      theme: theme(),
      page: page(),
    });

    expect(resolved.definition.id).toBe(DEFAULT_TEMPLATE_ID);
  });
});

describe("palettes and accent", () => {
  it("uses the template's first palette when the requested one is gone", () => {
    expect(resolve({ paletteId: "no-such-palette" }).colors.id).toBe(
      DEFAULT_TEMPLATE.palettes[0].id,
    );
  });

  it("selects the requested palette", () => {
    const palette = DEFAULT_TEMPLATE.palettes[2];

    expect(resolve({ paletteId: palette.id }).colors).toMatchObject({
      id: palette.id,
      accent: palette.accent,
    });
  });

  it("lets a valid accent override the palette's", () => {
    expect(resolve({ accent: "#ff0088" }).colors.accent).toBe("#ff0088");
  });

  it("ignores an accent that is not a hex colour", () => {
    const fallback = DEFAULT_TEMPLATE.palettes[0].accent;

    // Each of these would otherwise land inside a `style` attribute verbatim.
    for (const accent of ["red; background: url(//evil.example)", "#fff", "", "#12345g"]) {
      expect(resolve({ accent }).colors.accent).toBe(fallback);
    }
  });
});

describe("page setup", () => {
  it("converts the format's millimetres to pixels", () => {
    const a4 = resolve({}, { format: "a4" }).page;
    const letter = resolve({}, { format: "letter" }).page;

    expect(a4.widthPx).toBeCloseTo(mmToPx(PAGE_DIMENSIONS_MM.a4.width), 6);
    expect(a4.heightPx).toBeCloseTo(mmToPx(PAGE_DIMENSIONS_MM.a4.height), 6);
    expect(letter.widthPx).toBeCloseTo(mmToPx(PAGE_DIMENSIONS_MM.letter.width), 6);
    expect(letter.widthPx).not.toBeCloseTo(a4.widthPx, 1);
  });

  it("converts the margin and carries the page-number flag through", () => {
    const resolved = resolve({}, { margin: 20, showPageNumbers: true });

    expect(resolved.page.marginPx).toBeCloseTo(mmToPx(20), 6);
    expect(resolved.page.showPageNumbers).toBe(true);
  });

  it("scales content and never the paper", () => {
    const full = resolve({}, { scale: 1 });
    const shrunk = resolve({}, { scale: 0.9 });

    expect(shrunk.page.widthPx).toBeCloseTo(full.page.widthPx, 6);
    expect(shrunk.page.heightPx).toBeCloseTo(full.page.heightPx, 6);
    expect(shrunk.type.bodyPx).toBeCloseTo(full.type.bodyPx * 0.9, 6);
    expect(shrunk.spacing.sectionGapPx).toBeCloseTo(full.spacing.sectionGapPx * 0.9, 6);
    expect(shrunk.spacing.itemGapPx).toBeCloseTo(full.spacing.itemGapPx * 0.9, 6);
  });
});

describe("type and spacing", () => {
  it("derives every size from the body size in points", () => {
    const { tokens } = DEFAULT_TEMPLATE;
    const resolved = resolve({ fontSize: 12, lineHeight: 1.5 });
    const bodyPx = ptToPx(12);

    expect(resolved.type.bodyPx).toBeCloseTo(bodyPx, 6);
    expect(resolved.type.lineHeight).toBe(1.5);
    expect(resolved.type.namePx).toBeCloseTo(bodyPx * tokens.nameScale, 6);
    expect(resolved.type.headlinePx).toBeCloseTo(bodyPx * tokens.headlineScale, 6);
    expect(resolved.type.sectionTitlePx).toBeCloseTo(bodyPx * tokens.sectionTitleScale, 6);
    expect(resolved.type.uppercaseSectionTitles).toBe(tokens.uppercaseSectionTitles);
  });

  it("applies section spacing to section gaps only", () => {
    const base = resolve({ sectionSpacing: 1 });
    const roomy = resolve({ sectionSpacing: 1.5 });

    expect(roomy.spacing.sectionGapPx).toBeCloseTo(base.spacing.sectionGapPx * 1.5, 6);
    expect(roomy.spacing.itemGapPx).toBeCloseTo(base.spacing.itemGapPx, 6);
    expect(roomy.spacing.blockGapPx).toBeCloseTo(base.spacing.blockGapPx, 6);
  });
});

describe("fonts", () => {
  it("uses the template's pairing when the theme has no preference", () => {
    const resolved = resolve({ headingFont: null, bodyFont: null });

    expect(resolved.fonts.heading).toBe(DEFAULT_TEMPLATE.tokens.headingFont);
    expect(resolved.fonts.body).toBe(DEFAULT_TEMPLATE.tokens.bodyFont);
  });

  it("lets the theme override either half of the pairing", () => {
    const resolved = resolve({ headingFont: "playfair-display" });

    expect(resolved.fonts.heading).toBe("playfair-display");
    expect(resolved.fonts.body).toBe(DEFAULT_TEMPLATE.tokens.bodyFont);
  });
});
