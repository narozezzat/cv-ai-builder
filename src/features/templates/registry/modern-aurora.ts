/**
 * Modern Aurora — a filled band behind the name, quiet page beneath it.
 *
 * The banner carries all of the template's colour, so the section titles are plain: two
 * strong signals on one page compete, and the name should win.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const modernAurora: TemplateDefinition = {
  id: "modern-aurora",
  name: "Modern Aurora",
  description:
    "Colour band behind the header, uncluttered single column below. Bold without being loud.",
  category: "modern",
  layout: "header-banner",
  tokens: {
    headingFont: "geist",
    bodyFont: "inter",
    sectionTitle: "plain",
    uppercaseSectionTitles: true,
    sectionTitleTracking: 0.08,
    nameScale: 2.35,
    headlineScale: 1.1,
    sectionTitleScale: 0.9,
    density: 1.02,
    bullet: "disc",
    itemDivider: false,
    headerAlign: "left",
    bannerFill: "accent",
  },
  palettes: palettes("indigo", "slate", "teal", "rose", "carbon"),
};
