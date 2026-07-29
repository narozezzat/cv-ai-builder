/**
 * Elegant Serif — display serif over a serif body, centred, generous leading.
 *
 * The only template in the set with a serif body. Lora at a loose density stays readable at
 * 10pt, but it costs vertical space, so `density` is deliberately high rather than compact —
 * a serif squeezed to 0.9 reads as cramped, not efficient.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const elegantSerif: TemplateDefinition = {
  id: "elegant-serif",
  name: "Elegant Serif",
  description:
    "Display serif over a serif body, centred header, airy leading. For editorial and academic work.",
  category: "elegant",
  layout: "single-column",
  tokens: {
    headingFont: "playfair-display",
    bodyFont: "lora",
    sectionTitle: "plain",
    uppercaseSectionTitles: false,
    sectionTitleTracking: 0.02,
    nameScale: 2.4,
    headlineScale: 1.08,
    sectionTitleScale: 1,
    density: 1.08,
    bullet: "dash",
    itemDivider: false,
    headerAlign: "center",
  },
  palettes: palettes("bone", "ink", "oxblood", "forest", "sand"),
};
