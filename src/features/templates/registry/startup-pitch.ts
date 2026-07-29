/**
 * Startup Pitch — solid right sidebar, filled section bars, no dividers.
 *
 * Bars plus a solid rail is the loudest chrome the set allows; dividers on top of it would be
 * a third horizontal line per entry and the page stops having any quiet space in it.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const startupPitch: TemplateDefinition = {
  id: "startup-pitch",
  name: "Startup Pitch",
  description:
    "Solid colour rail on the right, filled section bars, punchy scale. Reads like a deck slide.",
  category: "startup",
  layout: "sidebar-right",
  tokens: {
    headingFont: "geist",
    bodyFont: "inter",
    sectionTitle: "bar",
    uppercaseSectionTitles: true,
    sectionTitleTracking: 0.07,
    nameScale: 2.25,
    headlineScale: 1.08,
    sectionTitleScale: 0.86,
    density: 1,
    bullet: "disc",
    itemDivider: false,
    headerAlign: "left",
    asideWidthPct: 34,
    asideFill: "solid",
  },
  palettes: palettes("indigo", "emerald", "carbon", "amber"),
};
