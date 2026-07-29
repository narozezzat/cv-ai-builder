/**
 * Tech Terminal — monospace headings, dense rhythm, skills in a right-hand column.
 *
 * Mono is on the headings only. A whole resume set in JetBrains Mono costs roughly a fifth
 * of the characters per line, which turns two pages into three; headings pay nothing for it.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const techTerminal: TemplateDefinition = {
  id: "tech-terminal",
  name: "Tech Terminal",
  description:
    "Monospace headings, tight rhythm, a stack column on the right. Reads like a well-kept README.",
  category: "tech",
  layout: "sidebar-right",
  tokens: {
    headingFont: "jetbrains-mono",
    bodyFont: "inter",
    sectionTitle: "plain",
    uppercaseSectionTitles: true,
    sectionTitleTracking: 0.06,
    nameScale: 1.9,
    headlineScale: 1,
    sectionTitleScale: 0.86,
    density: 0.94,
    bullet: "dash",
    itemDivider: false,
    headerAlign: "left",
    asideWidthPct: 30,
    asideFill: "tint",
  },
  palettes: palettes("carbon", "ink", "teal", "slate"),
};
