import { describe, expect, it } from "vitest";

import { HEX_COLOR_PATTERN } from "@/types/resume";

import { contrastRatio } from "./color";
import { onPaper, PALETTES, palettes } from "./palettes";
import type { TemplatePalette } from "./template-types";

const SLUG = /^[a-z0-9-]+$/;

/** Every colour slot on a palette, so a new one cannot be added without being checked. */
const COLOR_KEYS = [
  "surface",
  "heading",
  "body",
  "muted",
  "rule",
  "accent",
  "onAccent",
] as const satisfies readonly (keyof TemplatePalette)[];

describe("PALETTES", () => {
  it("is not empty", () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(12);
  });

  it("uses ids that are unique and safe to put in a URL or a data attribute", () => {
    const ids = PALETTES.map((palette) => palette.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const id of ids) {
      expect(id).toMatch(SLUG);
    }
  });

  it("names every palette", () => {
    for (const palette of PALETTES) {
      expect(palette.name.trim().length).toBeGreaterThan(0);
    }
  });

  /**
   * The load-bearing one: these values are interpolated into inline styles read by both
   * Chromium's print path and Satori. A shorthand or an `rgba()` would render in the
   * preview and silently fail in the PDF.
   */
  it("only ever uses 6-digit hex", () => {
    for (const palette of PALETTES) {
      for (const key of COLOR_KEYS) {
        expect(palette[key], `${palette.id}.${key}`).toMatch(HEX_COLOR_PATTERN);
      }
    }
  });

  /**
   * Contrast floors, checked here because a resume page is paper: there is no dark mode to
   * fall back to and no runtime that can re-theme it. A palette that fails is a template
   * that ships unreadable.
   */
  it("clears WCAG AA for text on its own surface", () => {
    for (const palette of PALETTES) {
      // Headings and body copy get the AAA floor — they are the whole document.
      expect(
        contrastRatio(palette.heading, palette.surface),
        `${palette.id}.heading`,
      ).toBeGreaterThanOrEqual(7);
      expect(
        contrastRatio(palette.body, palette.surface),
        `${palette.id}.body`,
      ).toBeGreaterThanOrEqual(7);
      // Metadata is small and grey by design, so AA rather than AAA — but never below it.
      expect(
        contrastRatio(palette.muted, palette.surface),
        `${palette.id}.muted`,
      ).toBeGreaterThanOrEqual(4.5);
      // The accent is a link colour, which means it is text.
      expect(
        contrastRatio(palette.accent, palette.surface),
        `${palette.id}.accent`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps onAccent readable on the accent fill", () => {
    for (const palette of PALETTES) {
      expect(
        contrastRatio(palette.onAccent, palette.accent),
        `${palette.id}.onAccent`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  /** A rule has to be visible on the page without reading as a line of text. */
  it("keeps rules faint but present", () => {
    for (const palette of PALETTES) {
      const ratio = contrastRatio(palette.rule, palette.surface);

      expect(ratio, `${palette.id}.rule`).toBeGreaterThan(1.05);
      expect(ratio, `${palette.id}.rule`).toBeLessThan(3);
    }
  });
});

describe("palettes", () => {
  it("returns the named palettes in offer order", () => {
    const set = palettes("navy", "slate", "sand", "emerald");

    expect(set.map((palette) => palette.id)).toEqual(["navy", "slate", "sand", "emerald"]);
  });

  it("accepts more than the required four", () => {
    expect(palettes("ink", "navy", "teal", "plum", "copper", "olive")).toHaveLength(6);
  });

  it("hands back the library objects, not copies, so a palette exists in one place", () => {
    const [first] = palettes("mist", "bone", "sand", "ink");

    expect(first).toBe(PALETTES.find((palette) => palette.id === "mist"));
  });
});

describe("onPaper", () => {
  it("keeps the ink and takes the paper", () => {
    const navyOnSand = onPaper("navy", "sand");
    const navy = PALETTES.find((palette) => palette.id === "navy");
    const sand = PALETTES.find((palette) => palette.id === "sand");

    expect(navyOnSand.heading).toBe(navy?.heading);
    expect(navyOnSand.accent).toBe(navy?.accent);
    expect(navyOnSand.surface).toBe(sand?.surface);
    expect(navyOnSand.rule).toBe(sand?.rule);
  });

  /** The derived id is what `theme.paletteId` stores, so it must be a slug and distinct. */
  it("derives a distinct slug id and a readable name", () => {
    const combined = onPaper("teal", "bone");

    expect(combined.id).toBe("teal-bone");
    expect(combined.id).toMatch(SLUG);
    expect(combined.name).toBe("Teal on Bone");
  });

  it("still clears the contrast floors", () => {
    for (const ink of ["navy", "teal", "oxblood", "olive"] as const) {
      for (const paper of ["sand", "bone", "mist"] as const) {
        const combined = onPaper(ink, paper);
        const label = combined.id;

        expect(contrastRatio(combined.body, combined.surface), label).toBeGreaterThanOrEqual(7);
        expect(contrastRatio(combined.muted, combined.surface), label).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(combined.accent, combined.surface), label).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
