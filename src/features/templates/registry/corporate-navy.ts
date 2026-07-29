/**
 * Corporate Navy — filled section bars in a single column, ruled entries.
 *
 * Single column with bars is the most literal reading of "corporate template", and it is also
 * the safest: the bar is a background, so an ATS still sees a plain heading and one column.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const corporateNavy: TemplateDefinition = {
  id: "corporate-navy",
  name: "Corporate Navy",
  description:
    "Filled section bars, ruled entries, single column. Familiar to every hiring committee.",
  category: "corporate",
  layout: "single-column",
  tokens: {
    headingFont: "lato",
    bodyFont: "lato",
    sectionTitle: "bar",
    uppercaseSectionTitles: true,
    sectionTitleTracking: 0.08,
    nameScale: 2.05,
    headlineScale: 1,
    sectionTitleScale: 0.85,
    density: 0.95,
    bullet: "disc",
    itemDivider: true,
    headerAlign: "left",
  },
  palettes: palettes("navy", "slate", "graphite", "forest"),
};
