/**
 * Corporate Column — a tinted left rail for skills and credentials, ruled entries beside it.
 *
 * Tint rather than solid: this category is read by conservative reviewers, and a tinted rail
 * survives a black-and-white office printer as a light grey band instead of a black slab.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const corporateColumn: TemplateDefinition = {
  id: "corporate-column",
  name: "Corporate Column",
  description:
    "Tinted left rail for skills and credentials, ruled entries beside it. Prints cleanly in mono.",
  category: "corporate",
  layout: "sidebar-left",
  tokens: {
    headingFont: "source-sans-3",
    bodyFont: "source-sans-3",
    sectionTitle: "underline",
    uppercaseSectionTitles: true,
    sectionTitleTracking: 0.06,
    nameScale: 2,
    headlineScale: 1,
    sectionTitleScale: 0.88,
    density: 0.94,
    bullet: "disc",
    itemDivider: true,
    headerAlign: "left",
    asideWidthPct: 33,
    asideFill: "tint",
  },
  palettes: palettes("navy", "mist", "graphite", "olive"),
};
