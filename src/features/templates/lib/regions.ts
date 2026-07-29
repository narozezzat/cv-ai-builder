/**
 * Filled regions — the tinted sidebar and the banner behind the header.
 *
 * A region is a rectangle of the page whose background is not the paper, which means the
 * palette that was checked for contrast against `surface` is no longer the palette in
 * effect there. Every atom in the render tree reads its colours from `template.colors`, so
 * the fix is to hand that subtree a template whose `colors` describe the region rather than
 * the page — not to thread a second set of colours through `ResumeHeader`, `SectionShell`,
 * and everything below them.
 *
 * The mix ratios below are not taste. They were picked by measuring `contrastRatio` for
 * every palette in the library against each candidate and taking the ones where the worst
 * palette still clears WCAG AA; `regions.test.ts` asserts that, so a new palette that
 * would be unreadable in a sidebar fails the suite instead of shipping.
 */

import { mixHex } from "./color";
import { withPaletteOverride, type ResolvedTemplate } from "./resolve-template";

/**
 * How far the tint moves from paper toward the heading colour. Small: the stripe has to
 * read as a change of paper, not as a grey box, and at 8% the muted text on it drops below
 * AA no matter how the palette compensates.
 */
export const REGION_TINT_MIX = 0.04;

/**
 * On a tint, metadata, links, and rules are darkened to buy back the contrast the tint
 * cost. A palette's rule is picked to be faint on paper, and the tint eats most of what
 * little separation it had — 1.13:1 at the worst palette, technically above the floor and
 * invisible in print.
 */
const TINTED_MUTED_MIX = 0.15;
const TINTED_ACCENT_MIX = 0.1;
const TINTED_RULE_MIX = 0.12;

/**
 * On a solid fill, everything is drawn in `onAccent`. Metadata is barely pulled toward the
 * fill — 5% is the difference between "secondary" and "unreadable" — and the rule is pulled
 * most of the way, because a divider on a coloured ground still has to look like a divider.
 */
const FILLED_MUTED_MIX = 0.05;
const FILLED_RULE_MIX = 0.7;

export interface RegionStyle {
  /** The template the region's contents render with. */
  template: ResolvedTemplate;
  /** The region's background, or `null` when the region is not filled at all. */
  background: string | null;
}

/** Paper, moved a few percent toward the heading colour. */
export function tintedSurface(template: ResolvedTemplate): string {
  return mixHex(template.colors.surface, template.colors.heading, REGION_TINT_MIX);
}

/**
 * The narrow column in `sidebar-left` / `sidebar-right`, per the template's `asideFill`.
 *
 * `none` returns the page template untouched, so a layout can render an unfilled aside
 * without special-casing it.
 */
export function asideRegion(template: ResolvedTemplate): RegionStyle {
  switch (template.definition.tokens.asideFill ?? "tint") {
    case "none":
      return { template, background: null };

    case "solid":
      return filledRegion(template, template.colors.accent);

    case "tint":
      return tintedRegion(template);
  }
}

/** The full-bleed band behind the header in `header-banner`, per `bannerFill`. */
export function bannerRegion(template: ResolvedTemplate): RegionStyle {
  switch (template.definition.tokens.bannerFill ?? "accent") {
    case "tint":
      return tintedRegion(template);

    case "heading":
      return filledRegion(template, template.colors.heading);

    case "accent":
      return filledRegion(template, template.colors.accent);
  }
}

function tintedRegion(template: ResolvedTemplate): RegionStyle {
  const { colors } = template;
  const surface = tintedSurface(template);

  return {
    background: surface,
    // Heading and body are left alone: they clear AAA on paper by enough margin that a 4%
    // tint keeps them above AA. Only the two colours that were already near the floor move.
    template: withPaletteOverride(template, {
      surface,
      muted: mixHex(colors.muted, colors.heading, TINTED_MUTED_MIX),
      accent: mixHex(colors.accent, colors.heading, TINTED_ACCENT_MIX),
      rule: mixHex(colors.rule, colors.heading, TINTED_RULE_MIX),
    }),
  };
}

/**
 * A region filled with one colour, with the palette inverted on top of it.
 *
 * `accent` and `onAccent` swap so a filled section title — the `bar` treatment — stays
 * legible: inside a solid region the bar is drawn in the light ink with the fill's colour
 * as its text, which is the only combination that has any contrast left.
 */
function filledRegion(template: ResolvedTemplate, fill: string): RegionStyle {
  const ink = template.colors.onAccent;

  return {
    background: fill,
    template: withPaletteOverride(template, {
      surface: fill,
      heading: ink,
      body: ink,
      muted: mixHex(ink, fill, FILLED_MUTED_MIX),
      rule: mixHex(ink, fill, FILLED_RULE_MIX),
      accent: ink,
      onAccent: fill,
    }),
  };
}
