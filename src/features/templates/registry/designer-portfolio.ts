/**
 * Designer Portfolio — centred header, two columns, no uppercase anywhere.
 *
 * Mixed case with almost no tracking is the whole voice of this one: it treats the section
 * name as a word rather than a label, which only works when nothing else on the page shouts.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const designerPortfolio: TemplateDefinition = {
  id: "designer-portfolio",
  name: "Designer Portfolio",
  description:
    "Centred header over two columns, mixed-case headings, no rules. Made for project-led work.",
  category: "designer",
  layout: "two-column-balanced",
  tokens: {
    headingFont: "geist",
    bodyFont: "lato",
    sectionTitle: "plain",
    uppercaseSectionTitles: false,
    sectionTitleTracking: 0.02,
    nameScale: 2.45,
    headlineScale: 1.15,
    sectionTitleScale: 0.96,
    density: 1.05,
    bullet: "dash",
    itemDivider: false,
    headerAlign: "center",
  },
  palettes: palettes("copper", "rose", "teal", "ink"),
};
