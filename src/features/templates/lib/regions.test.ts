/**
 * These are contrast tests, and they run over the whole palette library rather than over
 * the templates that happen to use a fill today. A sidebar or a banner re-derives its text
 * colours from the palette, so the numbers `palettes.test.ts` guarantees against paper say
 * nothing about the numbers inside a filled region — and a palette added six months from
 * now would otherwise ship a template whose sidebar is unreadable, with nothing failing.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_TEMPLATE_ID,
  HEX_COLOR_PATTERN,
  RESUME_PAGE_DEFAULTS,
  RESUME_THEME_DEFAULTS,
} from "@/types/resume";

import { contrastRatio } from "./color";
import { PALETTES } from "./palettes";
import { asideRegion, bannerRegion, REGION_TINT_MIX, tintedSurface } from "./regions";
import { resolveTemplate, type ResolvedTemplate } from "./resolve-template";
import type { TemplatePalette, TemplateTokens } from "./template-types";

const BASE = resolveTemplate({
  templateId: DEFAULT_TEMPLATE_ID,
  theme: RESUME_THEME_DEFAULTS,
  page: RESUME_PAGE_DEFAULTS,
});

function template(colors: TemplatePalette, tokens: Partial<TemplateTokens> = {}): ResolvedTemplate {
  return {
    ...BASE,
    definition: { ...BASE.definition, tokens: { ...BASE.definition.tokens, ...tokens } },
    colors,
  };
}

/**
 * The floors from `palettes.test.ts`, applied to a region's palette instead of a page's.
 *
 * `textFloor` is the one number that differs by fill. On paper and on a tint, heading and
 * body clear AAA. On a solid fill they cannot: the ink is `onAccent`, and the only promise
 * a palette makes about `onAccent` on `accent` is AA — raising it to AAA would mean no
 * palette could offer a mid-tone accent, which is most of them. AA is the standard; AAA on
 * the body copy is the bonus we keep where it is free.
 */
function expectReadable(colors: TemplatePalette, label: string, textFloor: number) {
  expect(contrastRatio(colors.heading, colors.surface), `${label}.heading`).toBeGreaterThanOrEqual(
    textFloor,
  );
  expect(contrastRatio(colors.body, colors.surface), `${label}.body`).toBeGreaterThanOrEqual(
    textFloor,
  );
  expect(contrastRatio(colors.muted, colors.surface), `${label}.muted`).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(colors.accent, colors.surface), `${label}.accent`).toBeGreaterThanOrEqual(
    4.5,
  );

  const rule = contrastRatio(colors.rule, colors.surface);

  expect(rule, `${label}.rule`).toBeGreaterThan(1.05);
  expect(rule, `${label}.rule`).toBeLessThan(3);

  /**
   * A `bar` section title paints `onAccent` on `accent`. Inside a filled region both are
   * swapped, so this pairing is the one most likely to collapse to a colour on itself.
   */
  expect(contrastRatio(colors.onAccent, colors.accent), `${label}.onAccent`).toBeGreaterThanOrEqual(
    4.5,
  );

  for (const [key, value] of Object.entries(colors)) {
    if (key !== "id" && key !== "name") {
      expect(value, `${label}.${key}`).toMatch(HEX_COLOR_PATTERN);
    }
  }
}

describe("tintedSurface", () => {
  it("stays close to the paper it came from", () => {
    for (const palette of PALETTES) {
      const tint = tintedSurface(template(palette));

      expect(tint, palette.id).not.toBe(palette.surface);
      // Close enough to read as paper: a fill this pale cannot be more than ~1.3:1 off it.
      expect(contrastRatio(tint, palette.surface), palette.id).toBeLessThan(1.3);
    }
  });

  it("moves toward the heading colour, not toward grey", () => {
    // Locked because the tint's direction is what the compensating mixes were measured
    // against; flipping it toward black would invalidate every floor below.
    expect(REGION_TINT_MIX).toBeGreaterThan(0);
    expect(REGION_TINT_MIX).toBeLessThan(0.08);
  });
});

describe("asideRegion", () => {
  it("tints by default, so a template that sets no fill still gets a sidebar", () => {
    const resolved = template(PALETTES[0]);
    const region = asideRegion(resolved);

    expect(region.background).toBe(tintedSurface(resolved));
    expect(region.template.colors.surface).toBe(region.background);
  });

  it("hands back the page template untouched when the fill is none", () => {
    const resolved = template(PALETTES[0], { asideFill: "none" });
    const region = asideRegion(resolved);

    expect(region.background).toBeNull();
    expect(region.template).toBe(resolved);
  });

  it("fills with the accent and inverts the ink when the fill is solid", () => {
    const resolved = template(PALETTES[0], { asideFill: "solid" });
    const { background, template: region } = asideRegion(resolved);

    expect(background).toBe(resolved.colors.accent);
    expect(region.colors.surface).toBe(resolved.colors.accent);
    expect(region.colors.heading).toBe(resolved.colors.onAccent);
    expect(region.colors.body).toBe(resolved.colors.onAccent);
    // Swapped, so a filled section title inside a filled column still has contrast.
    expect(region.colors.accent).toBe(resolved.colors.onAccent);
    expect(region.colors.onAccent).toBe(resolved.colors.accent);
  });

  it("keeps every palette readable at every fill", () => {
    for (const fill of ["none", "tint", "solid"] as const) {
      for (const palette of PALETTES) {
        const region = asideRegion(template(palette, { asideFill: fill }));

        expectReadable(region.template.colors, `${palette.id}/${fill}`, fill === "solid" ? 4.5 : 7);
      }
    }
  });
});

describe("bannerRegion", () => {
  it("fills with the accent by default", () => {
    const resolved = template(PALETTES[0]);

    expect(bannerRegion(resolved).background).toBe(resolved.colors.accent);
  });

  it("can fill with the heading colour instead", () => {
    const resolved = template(PALETTES[0], { bannerFill: "heading" });
    const { background, template: region } = bannerRegion(resolved);

    expect(background).toBe(resolved.colors.heading);
    expect(region.colors.heading).toBe(resolved.colors.onAccent);
  });

  it("keeps every palette readable at every fill", () => {
    for (const fill of ["accent", "heading", "tint"] as const) {
      for (const palette of PALETTES) {
        const region = bannerRegion(template(palette, { bannerFill: fill }));

        // A banner on the heading colour is dark in every palette, so it keeps the AAA
        // floor; only the accent fill has to settle for AA.
        expectReadable(
          region.template.colors,
          `${palette.id}/${fill}`,
          fill === "accent" ? 4.5 : 7,
        );
      }
    }
  });
});

describe("a region", () => {
  /**
   * The deliberate limit of `withPaletteOverride`: a region restyles itself and nothing
   * else. If a fill could change the page box or the type scale, the layout that placed it
   * would be measuring one thing and rendering another.
   */
  it("changes colours and nothing else", () => {
    const resolved = template(PALETTES[0], { asideFill: "solid" });
    const region = asideRegion(resolved).template;

    expect(region.page).toBe(resolved.page);
    expect(region.type).toBe(resolved.type);
    expect(region.spacing).toBe(resolved.spacing);
    expect(region.fonts).toBe(resolved.fonts);
    expect(region.definition).toBe(resolved.definition);
  });
});
