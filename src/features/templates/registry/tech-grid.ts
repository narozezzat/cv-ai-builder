/**
 * Tech Grid — two balanced columns, the densest template in the set.
 *
 * `two-column-balanced` cuts on estimated weight rather than by section kind, so a resume
 * that is mostly projects still fills both columns instead of stacking them.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const techGrid: TemplateDefinition = {
  id: "tech-grid",
  name: "Tech Grid",
  description:
    "Two balanced columns at a compact rhythm. Fits projects, stack, and history on one page.",
  category: "tech",
  layout: "two-column-balanced",
  tokens: {
    headingFont: "ibm-plex-sans",
    bodyFont: "ibm-plex-sans",
    sectionTitle: "underline",
    uppercaseSectionTitles: true,
    sectionTitleTracking: 0.07,
    nameScale: 2,
    headlineScale: 1.02,
    sectionTitleScale: 0.88,
    density: 0.92,
    bullet: "disc",
    itemDivider: false,
    headerAlign: "left",
  },
  palettes: palettes("slate", "carbon", "emerald", "indigo"),
};
