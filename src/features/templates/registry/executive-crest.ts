/**
 * Executive Crest — display serif on a deep band, wide-tracked small caps beneath.
 *
 * Playfair at 2.2× is the largest display face in the set, which is also why the section
 * titles are the smallest: the hierarchy has to be a jump, not a gradient.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const executiveCrest: TemplateDefinition = {
  id: "executive-crest",
  name: "Executive Crest",
  description: "Display serif on a deep header band, wide-tracked labels below. Board-room formal.",
  category: "executive",
  layout: "header-banner",
  tokens: {
    headingFont: "playfair-display",
    bodyFont: "source-sans-3",
    sectionTitle: "plain",
    uppercaseSectionTitles: true,
    sectionTitleTracking: 0.14,
    nameScale: 2.2,
    headlineScale: 1.05,
    sectionTitleScale: 0.82,
    density: 1,
    bullet: "dash",
    itemDivider: true,
    headerAlign: "center",
    bannerFill: "heading",
  },
  palettes: palettes("navy", "oxblood", "ink", "forest"),
};
