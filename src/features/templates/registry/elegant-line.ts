/**
 * Elegant Line — small tracked-out headings in a gutter, bodies behind a hairline rule.
 *
 * The widest tracking in the set (0.16) on the smallest heading (0.8): at that size the letters
 * need the air, and the gutter already carries the hierarchy the size would otherwise have to.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const elegantLine: TemplateDefinition = {
  id: "elegant-line",
  name: "Elegant Line",
  description:
    "Small tracked-out headings in a gutter, bodies behind a hairline rule. Quiet and considered.",
  category: "elegant",
  layout: "timeline-split",
  tokens: {
    headingFont: "lora",
    bodyFont: "source-serif-4",
    sectionTitle: "plain",
    uppercaseSectionTitles: true,
    sectionTitleTracking: 0.16,
    nameScale: 2.1,
    headlineScale: 1.02,
    sectionTitleScale: 0.8,
    density: 1.1,
    bullet: "dash",
    itemDivider: false,
    headerAlign: "left",
  },
  palettes: palettes("sand", "bone", "navy", "plum"),
};
