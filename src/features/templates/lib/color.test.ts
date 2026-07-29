import { describe, expect, it } from "vitest";

import { HEX_COLOR_PATTERN } from "@/types/resume";

import { contrastRatio, mixHex } from "./color";

describe("mixHex", () => {
  it("returns the endpoints at 0 and 1", () => {
    expect(mixHex("#123456", "#abcdef", 0)).toBe("#123456");
    expect(mixHex("#123456", "#abcdef", 1)).toBe("#abcdef");
  });

  it("blends channel by channel", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#ff0000", "#0000ff", 0.5)).toBe("#800080");
  });

  it("clamps a ratio outside 0..1 instead of wrapping past the endpoint", () => {
    expect(mixHex("#000000", "#ffffff", -3)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 42)).toBe("#ffffff");
  });

  /**
   * `NaN` is the one clamp `Math.min`/`Math.max` does not catch, and it formats as the
   * literal "nan" rather than throwing — an inline style that silently paints nothing.
   */
  it("treats a non-finite ratio as 0 rather than emitting 'nan' channels", () => {
    expect(mixHex("#000000", "#ffffff", Number.NaN)).toBe("#000000");
    expect(mixHex("#123456", "#abcdef", Number.POSITIVE_INFINITY)).toBe("#123456");
  });

  /**
   * The load-bearing property: this value lands in an inline `style` and is validated
   * elsewhere by the same pattern that guards `theme.accent`. A shorthand, an `rgba()`,
   * or an 8-digit result would pass Chromium and fail Satori.
   */
  it("always produces a value the hex pattern accepts", () => {
    const inputs = ["#ffffff", "#000000", "#0f172a", "#b45309", "#2563EB"];

    for (const from of inputs) {
      for (const to of inputs) {
        for (const ratio of [0, 0.07, 0.33, 0.5, 0.94, 1]) {
          expect(mixHex(from, to, ratio)).toMatch(HEX_COLOR_PATTERN);
        }
      }
    }
  });

  it("normalizes case so two spellings of one colour compare equal", () => {
    expect(mixHex("#2563EB", "#2563eb", 0.5)).toBe("#2563eb");
  });

  it("degrades to the argument that parsed rather than throwing", () => {
    expect(mixHex("#fff", "#123456", 0.5)).toBe("#123456");
    expect(mixHex("#123456", "not-a-colour", 0.5)).toBe("#123456");
    expect(mixHex("", "", 0.5)).toBe("#000000");
  });

  it("ignores surrounding whitespace", () => {
    expect(mixHex("  #ffffff  ", "#000000", 0)).toBe("#ffffff");
  });
});

describe("contrastRatio", () => {
  it("scores the extremes", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
    expect(contrastRatio("#2563eb", "#2563eb")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#0f172a", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#0f172a"),
      10,
    );
  });

  it("agrees with the published ratio for a known pair", () => {
    // #767676 on white is the canonical WCAG AA boundary for body text.
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.6);
  });

  /** A malformed colour must fail a floor check, not slip past one. */
  it("scores unparseable input as no contrast at all", () => {
    expect(contrastRatio("#fff", "#000000")).toBe(1);
    expect(contrastRatio("", "")).toBe(1);
  });
});
