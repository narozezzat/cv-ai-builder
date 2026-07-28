/**
 * Flattens "which template" + "what the user changed" into numbers a component can put
 * straight into a `style` prop.
 *
 * Three inputs land here — the template's own tokens, the resume's `theme`, and its
 * `page` setup — and the precedence between them is the whole point: a theme override
 * wins over a template default, a template default wins over nothing. Doing that
 * merging inside the layout components would mean every layout re-deriving the same
 * fallbacks, and the print route and the preview drifting the first time one of them
 * got it wrong.
 *
 * Everything comes out in **CSS pixels**, because both consumers speak pixels: the
 * preview scales a pixel-sized box with `transform`, and Chromium's `page.pdf()` maps
 * 96 CSS px to an inch. Millimetres and points exist in the schema because that is how
 * humans describe paper and type; they are converted here, once.
 */

import {
  HEX_COLOR_PATTERN,
  PAGE_DIMENSIONS_MM,
  type ResumeFont,
  type ResumePage,
  type ResumeTheme,
} from "@/types/resume";

import { getTemplateDefinition } from "../registry";
import type { TemplateDefinition, TemplatePalette } from "./template-types";

/** CSS defines an inch as 96px, and there are 25.4mm and 72pt to the inch. */
export const MM_TO_PX = 96 / 25.4;
export const PT_TO_PX = 96 / 72;

export function mmToPx(mm: number): number {
  return mm * MM_TO_PX;
}

export function ptToPx(pt: number): number {
  return pt * PT_TO_PX;
}

/**
 * The vertical rhythm at `sectionSpacing: 1`, `density: 1`, `scale: 1`. Chosen against a
 * 10.5pt body (14px): a section break reads as a break at ~1.4× the line box, and items
 * inside a section sit closer together than the sections do.
 */
const BASE_SECTION_GAP_PX = 20;
const BASE_ITEM_GAP_PX = 12;
const BASE_BLOCK_GAP_PX = 4;

export interface ResolvedTemplate {
  definition: TemplateDefinition;
  /** The chosen palette, with `accent` already overridden if the resume set one. */
  colors: TemplatePalette;
  fonts: { heading: ResumeFont; body: ResumeFont };
  page: {
    widthPx: number;
    heightPx: number;
    marginPx: number;
    showPageNumbers: boolean;
  };
  type: {
    bodyPx: number;
    lineHeight: number;
    namePx: number;
    headlinePx: number;
    sectionTitlePx: number;
    /** `em`, so it tracks whatever the section title ends up sized at. */
    sectionTitleTracking: number;
    uppercaseSectionTitles: boolean;
  };
  spacing: {
    /** Between sections. */
    sectionGapPx: number;
    /** Between repeated items inside a section. */
    itemGapPx: number;
    /** Between the lines of one item — title, meta, prose, bullets. */
    blockGapPx: number;
  };
}

export interface ResolveTemplateInput {
  templateId: string;
  theme: ResumeTheme;
  page: ResumePage;
}

export function resolveTemplate({
  templateId,
  theme,
  page,
}: ResolveTemplateInput): ResolvedTemplate {
  const definition = getTemplateDefinition(templateId);
  const { tokens } = definition;

  const palette =
    definition.palettes.find((candidate) => candidate.id === theme.paletteId) ??
    definition.palettes[0];

  /**
   * Re-validated here even though `resumeThemeSchema` already enforced the pattern on
   * the way in. This value is interpolated into inline CSS, and the row it came from is
   * reachable by anything holding a service-role key or a future import path that
   * bypasses the schema. A colour picker's output costs one regex to check; an
   * unchecked string in a `style` attribute is an injection surface.
   */
  const accent =
    theme.accent !== null && HEX_COLOR_PATTERN.test(theme.accent) ? theme.accent : palette.accent;

  const dimensions = PAGE_DIMENSIONS_MM[page.format];

  /**
   * `page.scale` shrinks or grows the *content*, never the paper. A4 stays A4 — that is
   * the contract with the printer — so scaling type and rhythm together is what "fit
   * more on the page" has to mean.
   */
  const scale = page.scale;
  const bodyPx = ptToPx(theme.fontSize) * scale;

  return {
    definition,
    colors: { ...palette, accent },
    fonts: {
      heading: theme.headingFont ?? tokens.headingFont,
      body: theme.bodyFont ?? tokens.bodyFont,
    },
    page: {
      widthPx: mmToPx(dimensions.width),
      heightPx: mmToPx(dimensions.height),
      marginPx: mmToPx(page.margin),
      showPageNumbers: page.showPageNumbers,
    },
    type: {
      bodyPx,
      lineHeight: theme.lineHeight,
      namePx: bodyPx * tokens.nameScale,
      headlinePx: bodyPx * tokens.headlineScale,
      sectionTitlePx: bodyPx * tokens.sectionTitleScale,
      sectionTitleTracking: tokens.sectionTitleTracking,
      uppercaseSectionTitles: tokens.uppercaseSectionTitles,
    },
    spacing: {
      sectionGapPx: BASE_SECTION_GAP_PX * theme.sectionSpacing * tokens.density * scale,
      itemGapPx: BASE_ITEM_GAP_PX * tokens.density * scale,
      blockGapPx: BASE_BLOCK_GAP_PX * tokens.density * scale,
    },
  };
}
