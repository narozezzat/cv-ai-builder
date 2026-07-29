/**
 * Minimal Quiet — small tracked headings in a gutter, content behind a hairline.
 *
 * The heading is deliberately the smallest text on the page (`sectionTitleScale` below 1):
 * in a gutter it is already unmissable by position, so size would only shout.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const minimalQuiet: TemplateDefinition = {
  id: "minimal-quiet",
  name: "Minimal Quiet",
  description:
    "Section labels in a left gutter, content behind a hairline. Structured without a single box.",
  category: "minimal",
  layout: "timeline-split",
  tokens: {
    headingFont: "inter",
    bodyFont: "inter",
    sectionTitle: "plain",
    uppercaseSectionTitles: true,
    sectionTitleTracking: 0.12,
    nameScale: 1.8,
    headlineScale: 0.98,
    sectionTitleScale: 0.78,
    density: 1.08,
    bullet: "dash",
    itemDivider: false,
    headerAlign: "left",
  },
  palettes: palettes("graphite", "ink", "mist", "sand"),
};
