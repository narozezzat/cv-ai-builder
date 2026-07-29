/**
 * Creative Arc — a centred name on a dark band, lowercase headings, open page.
 *
 * `bannerFill: "heading"` rather than the accent: the heading colour is the darkest value in
 * every palette, so a large centred name on it holds AAA where a mid-tone accent would not.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const creativeArc: TemplateDefinition = {
  id: "creative-arc",
  name: "Creative Arc",
  description: "Centred name on a deep band, untracked headings, wide margins of white beneath it.",
  category: "creative",
  layout: "header-banner",
  tokens: {
    headingFont: "geist",
    bodyFont: "lato",
    sectionTitle: "plain",
    uppercaseSectionTitles: false,
    sectionTitleTracking: 0.03,
    nameScale: 2.5,
    headlineScale: 1.12,
    sectionTitleScale: 0.95,
    density: 1.06,
    bullet: "disc",
    itemDivider: false,
    headerAlign: "center",
    bannerFill: "heading",
  },
  palettes: palettes("rose", "plum", "copper", "teal"),
};
