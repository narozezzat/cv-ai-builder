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
 * Layouts that exist. Phase 4 adds the sidebar, banner, and timeline variants; listing
 * ids here before their component exists would let a registry entry reference a layout
 * that renders nothing.
 */
export const TEMPLATE_LAYOUTS = ["single-column"] as const;

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
