/**
 * Modern Slate — the default.
 *
 * Uppercase tracked section titles over a hairline rule, a large name, single column.
 * It is the default because it is the safest thing to open a blank resume into: every
 * ATS parses a single column correctly, and nothing about it has to be undone before it
 * can be sent to a human.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const modernSlate: TemplateDefinition = {
  id: "modern-slate",
  name: "Modern Slate",
  description:
    "Clean single column with tracked section rules. Parses correctly in every ATS and reads well on paper.",
  category: "modern",
  layout: "single-column",
  tokens: {
    headingFont: "geist",
    bodyFont: "inter",
    sectionTitle: "underline",
    uppercaseSectionTitles: true,
    sectionTitleTracking: 0.09,
    nameScale: 2.15,
    headlineScale: 1.05,
    sectionTitleScale: 0.92,
    density: 1,
    bullet: "disc",
    itemDivider: false,
    headerAlign: "left",
  },
  palettes: palettes("slate", "graphite", "emerald", "plum", "sand"),
};
