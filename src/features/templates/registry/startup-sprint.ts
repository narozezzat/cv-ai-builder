/**
 * Startup Sprint — two balanced columns at the tightest density in the set.
 *
 * Density 0.93 with a two-column split is the highest information rate the layouts allow. It is
 * meant for the generalist resume that has projects, a stack, and a short history all at once.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const startupSprint: TemplateDefinition = {
  id: "startup-sprint",
  name: "Startup Sprint",
  description:
    "Two balanced columns at a tight rhythm. Built to hold projects, stack, and history on one page.",
  category: "startup",
  layout: "two-column-balanced",
  tokens: {
    headingFont: "inter",
    bodyFont: "inter",
    sectionTitle: "underline",
    uppercaseSectionTitles: true,
    sectionTitleTracking: 0.06,
    nameScale: 2.05,
    headlineScale: 1.02,
    sectionTitleScale: 0.88,
    density: 0.93,
    bullet: "disc",
    itemDivider: false,
    headerAlign: "left",
  },
  palettes: palettes("emerald", "slate", "indigo", "copper"),
};
