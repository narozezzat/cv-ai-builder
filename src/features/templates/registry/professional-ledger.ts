/**
 * Professional Ledger — dense, ruled, built for a long history.
 *
 * `density` below 1 and `itemDivider` on: this is the template for the candidate with nine
 * roles, where fitting two pages instead of three matters more than air does.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const professionalLedger: TemplateDefinition = {
  id: "professional-ledger",
  name: "Professional Ledger",
  description:
    "Tight rhythm and ruled entries. Fits a long career onto fewer pages without crowding.",
  category: "professional",
  layout: "single-column",
  tokens: {
    headingFont: "source-sans-3",
    bodyFont: "source-sans-3",
    sectionTitle: "underline",
    uppercaseSectionTitles: true,
    sectionTitleTracking: 0.06,
    nameScale: 2.05,
    headlineScale: 1.02,
    sectionTitleScale: 0.9,
    density: 0.96,
    bullet: "disc",
    itemDivider: true,
    headerAlign: "left",
  },
  palettes: palettes("navy", "slate", "graphite", "forest", "oxblood"),
};
