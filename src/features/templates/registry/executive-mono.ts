/**
 * Executive Mono — serif headings, sans body, centred contact block, ruled entries.
 *
 * The pairing is the point: a serif name reads as seniority, and a sans body keeps a page of
 * dense bullets legible at 10pt where a serif would not be.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const executiveMono: TemplateDefinition = {
  id: "executive-mono",
  name: "Executive Mono",
  description:
    "Serif headings over a sans body, centred contact block, ruled entries. Restrained and senior.",
  category: "executive",
  layout: "single-column",
  tokens: {
    headingFont: "source-serif-4",
    bodyFont: "source-sans-3",
    sectionTitle: "underline",
    uppercaseSectionTitles: true,
    sectionTitleTracking: 0.1,
    nameScale: 2.1,
    headlineScale: 1.04,
    sectionTitleScale: 0.86,
    density: 0.98,
    bullet: "dash",
    itemDivider: true,
    headerAlign: "center",
  },
  palettes: palettes("ink", "navy", "oxblood", "graphite", "bone"),
};
