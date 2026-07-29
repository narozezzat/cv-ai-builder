/**
 * What a template *is*.
 *
 * A template is data, not a component: a layout id plus design tokens plus a set of
 * palettes. Twenty templates are therefore twenty config objects sharing a handful of
 * layout components, which is the only way section reordering, visibility toggles, and
 * palette switching can work for every template without being reimplemented twenty
 * times.
 *
 * Colours are plain hex, not `oklch()` and not CSS variables, for two reasons: Satori
 * and Chromium's print path both handle hex without surprises, and a resume page is
 * paper — it must not follow the app's dark mode. `resumes` render the same on a
 * midnight dashboard as they do in the PDF.
 */

import type { ResumeFont } from "@/types/resume";

/**
 * Layouts that exist, each with a component in `layouts/` and a `case` in the renderer's
 * switch. The switch ends in a `never` assignment, so adding an id here without its
 * component is a compile error rather than a template that renders a blank page.
 *
 * Matches the `layout` CHECK constraint on `resume_templates`.
 */
export const TEMPLATE_LAYOUTS = [
  "single-column",
  "sidebar-left",
  "sidebar-right",
  "header-banner",
  "timeline-split",
  "two-column-balanced",
] as const;

export type TemplateLayoutId = (typeof TEMPLATE_LAYOUTS)[number];

export const TEMPLATE_CATEGORIES = [
  "modern",
  "minimal",
  "professional",
  "creative",
  "executive",
  "tech",
  "designer",
  "corporate",
  "elegant",
  "startup",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  modern: "Modern",
  minimal: "Minimal",
  professional: "Professional",
  creative: "Creative",
  executive: "Executive",
  tech: "Tech",
  designer: "Designer",
  corporate: "Corporate",
  elegant: "Elegant",
  startup: "Startup",
};

export interface TemplatePalette {
  /** Slug, matched against `theme.paletteId`. */
  id: string;
  name: string;
  /** The page itself. Paper white in most palettes; tinted in a few. */
  surface: string;
  /** Name, section titles, item titles. */
  heading: string;
  /** Body prose and bullets. */
  body: string;
  /** Dates, locations, secondary metadata. */
  muted: string;
  /** Rules and dividers. */
  rule: string;
  /** Accent fills and links. Overridable per resume via `theme.accent`. */
  accent: string;
  /** Text drawn on top of `accent` — pill labels, filled section bars. */
  onAccent: string;
}

export interface TemplateTokens {
  /** Defaults; `theme.headingFont` / `theme.bodyFont` override when set. */
  headingFont: ResumeFont;
  bodyFont: ResumeFont;
  /** How a section title is separated from its content. */
  sectionTitle: "plain" | "underline" | "bar";
  uppercaseSectionTitles: boolean;
  /** Letter spacing on section titles, in `em`. Uppercase titles need positive tracking. */
  sectionTitleTracking: number;
  /** Multipliers on the resolved body size. */
  nameScale: number;
  headlineScale: number;
  sectionTitleScale: number;
  /**
   * Multiplier on the vertical rhythm. Below 1 fits more on the page; a dense template
   * and a generous one differ mostly by this number.
   */
  density: number;
  bullet: "disc" | "dash";
  /** A hairline between repeated items. */
  itemDivider: boolean;
  /**
   * Where the name and contact block sits. Required rather than defaulted: it is the
   * first thing a reader sees, so every template should have had to decide.
   */
  headerAlign: "left" | "center";
  /**
   * Width of the narrow column in the sidebar layouts, as a percentage of the content
   * box. Ignored by every other layout. Below ~26% skill pills start wrapping one per
   * line; above ~42% the main column stops holding a bullet on one line.
   *
   * @default 34
   */
  asideWidthPct?: number;
  /**
   * How the sidebar column is separated from the page. `tint` is a pale wash of the
   * heading colour, `solid` fills it with the accent and inverts the text on top of it.
   * Ignored outside the sidebar layouts.
   *
   * @default "tint"
   */
  asideFill?: "none" | "tint" | "solid";
  /**
   * What the full-bleed band behind the header is filled with. `accent` and `heading`
   * invert the text; `tint` keeps it. Ignored outside `header-banner`.
   *
   * @default "accent"
   */
  bannerFill?: "accent" | "heading" | "tint";
}

export interface TemplateDefinition {
  /** Slug stored in `resumes.template_id`. */
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  layout: TemplateLayoutId;
  tokens: TemplateTokens;
  /** At least one. The first is the default when `theme.paletteId` matches nothing. */
  palettes: readonly [TemplatePalette, ...TemplatePalette[]];
}
