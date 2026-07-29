/**
 * These assert the two things about this stylesheet that break silently.
 *
 * A missing `@page` produces a PDF at Chromium's default Letter size regardless of what the
 * user chose, and an `@page` present on a *preview* makes twenty gallery thumbnails fight
 * over one document-global sheet size. Neither throws; both are only visible in the output.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_TEMPLATE_ID,
  RESUME_PAGE_DEFAULTS,
  RESUME_THEME_DEFAULTS,
  type ResumePage,
} from "@/types/resume";

import { proseScope, resumeStyles } from "./page-styles";
import { resolveTemplate } from "./resolve-template";

function resolve(pagePatch: Partial<ResumePage> = {}) {
  return resolveTemplate({
    templateId: DEFAULT_TEMPLATE_ID,
    theme: RESUME_THEME_DEFAULTS,
    page: { ...RESUME_PAGE_DEFAULTS, ...pagePatch },
  });
}

describe("proseScope", () => {
  it("is stable for the same resolved template", () => {
    expect(proseScope(resolve())).toBe(proseScope(resolve()));
  });

  it("differs when the page setup changes the rhythm", () => {
    expect(proseScope(resolve())).not.toBe(proseScope(resolve({ scale: 0.9 })));
  });

  /** The value is interpolated into a selector, so it must not be able to close one. */
  it("only emits characters that are safe in a selector", () => {
    expect(proseScope(resolve())).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("resumeStyles", () => {
  it("scopes every rule to the page it was built for", () => {
    const template = resolve();
    const scope = proseScope(template);
    const css = resumeStyles(template, scope, { printTarget: false });

    expect(css).toContain(`[data-resume-scope="${scope}"]`);

    // Every selector — not just the first — has to carry the scope, or one resume's rules
    // leak onto its neighbours in the gallery.
    for (const rule of css.split("}").filter((part) => part.includes("{"))) {
      const selector = rule.slice(0, rule.indexOf("{"));
      if (selector.startsWith("@")) continue;
      expect(selector, selector).toContain(`[data-resume-scope="${scope}"]`);
    }
  });

  it("keeps the paper out of a preview", () => {
    const template = resolve();
    const css = resumeStyles(template, proseScope(template), { printTarget: false });

    expect(css).not.toContain("@page");
    expect(css).not.toContain("@media print");
  });

  it("declares the chosen sheet size on the print target", () => {
    const template = resolve();
    const css = resumeStyles(template, proseScope(template), { printTarget: true });

    // A4 at 96px per inch. Rounded to 2dp by the builder, as CSS lengths are.
    expect(css).toContain("@page{size:793.7px 1122.52px;margin:0}");
  });

  it("follows the page format", () => {
    const letter = resolve({ format: "letter" });
    const css = resumeStyles(letter, proseScope(letter), { printTarget: true });

    expect(css).toContain("@page{size:816px 1056px;margin:0}");
  });

  /**
   * The `<article>` applies the page margin as padding. A non-zero `@page` margin would
   * add a second one and every export would come out inset twice.
   */
  it("never adds a margin on top of the article's padding", () => {
    const template = resolve({ margin: 24 });
    const css = resumeStyles(template, proseScope(template), { printTarget: true });

    expect(css).toContain("margin:0}");
    expect(css).not.toMatch(/@page\{[^}]*margin:(?!0)/);
  });

  it("protects headings and bullets from the page break in both targets", () => {
    for (const printTarget of [false, true]) {
      const template = resolve();
      const css = resumeStyles(template, proseScope(template), { printTarget });

      expect(css).toContain("orphans:2;widows:2");
      expect(css).toContain("break-after:avoid");
      expect(css).toContain("li{page-break-inside:avoid;break-inside:avoid}");
    }
  });

  it("forces background rendering on the printed sheet", () => {
    const template = resolve();
    const css = resumeStyles(template, proseScope(template), { printTarget: true });

    expect(css).toContain("print-color-adjust:exact");
    expect(css).toContain(template.colors.surface);
  });
});
