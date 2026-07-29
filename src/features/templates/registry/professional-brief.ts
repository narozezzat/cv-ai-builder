/**
 * Professional Brief — experience left, skills in a tinted column right of nothing.
 *
 * A tint rather than a solid fill: the sidebar is supporting detail here, and an accent
 * block beside the experience would pull the eye away from it.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const professionalBrief: TemplateDefinition = {
  id: "professional-brief",
  name: "Professional Brief",
  description:
    "Experience in the wide column, skills and languages in a tinted sidebar. Reads like a briefing.",
  category: "professional",
  layout: "sidebar-left",
  tokens: {
    headingFont: "ibm-plex-sans",
    bodyFont: "inter",
    sectionTitle: "underline",
    uppercaseSectionTitles: true,
    sectionTitleTracking: 0.07,
    nameScale: 2,
    headlineScale: 1,
    sectionTitleScale: 0.88,
    density: 0.95,
    bullet: "disc",
    itemDivider: false,
    headerAlign: "left",
    asideWidthPct: 32,
    asideFill: "tint",
  },
  palettes: palettes("navy", "teal", "graphite", "olive"),
};
