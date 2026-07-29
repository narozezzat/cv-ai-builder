/**
 * Designer Studio — the widest solid sidebar, large name, filled section bars.
 *
 * At 38% the aside is near the clamp's ceiling (`layout-shared.ts`), which is the point:
 * skill pills and languages get room to sit two per line instead of wrapping singly.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const designerStudio: TemplateDefinition = {
  id: "designer-studio",
  name: "Designer Studio",
  description:
    "Wide colour sidebar on the right, large name, filled section bars. Confident and graphic.",
  category: "designer",
  layout: "sidebar-right",
  tokens: {
    headingFont: "geist",
    bodyFont: "inter",
    sectionTitle: "bar",
    uppercaseSectionTitles: true,
    sectionTitleTracking: 0.1,
    nameScale: 2.4,
    headlineScale: 1.1,
    sectionTitleScale: 0.84,
    density: 1.04,
    bullet: "disc",
    itemDivider: false,
    headerAlign: "left",
    asideWidthPct: 38,
    asideFill: "solid",
  },
  palettes: palettes("teal", "plum", "amber", "rose", "carbon"),
};
