/**
 * Minimal Thin — one typeface, no rules, generous air.
 *
 * Nothing separates a section but space, which is why `density` is above 1: with no rule to
 * mark the boundary, the gap has to be unmistakable or the page reads as one long block.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const minimalThin: TemplateDefinition = {
  id: "minimal-thin",
  name: "Minimal Thin",
  description:
    "One typeface, no dividers, space doing the separating. For work that should speak first.",
  category: "minimal",
  layout: "single-column",
  tokens: {
    headingFont: "inter",
    bodyFont: "inter",
    sectionTitle: "plain",
    uppercaseSectionTitles: false,
    sectionTitleTracking: 0.02,
    nameScale: 1.95,
    headlineScale: 1,
    sectionTitleScale: 1,
    density: 1.1,
    bullet: "dash",
    itemDivider: false,
    headerAlign: "left",
  },
  palettes: palettes("ink", "graphite", "slate", "bone"),
};
