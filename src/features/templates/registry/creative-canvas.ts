/**
 * Creative Canvas — a solid accent column with inverted text, filled section bars.
 *
 * The most saturated template in the set. `asideFill: "solid"` inverts the sidebar's ink to
 * `onAccent`, which is the one place the palette contract drops from AAA to AA — see
 * `regions.test.ts` for why that floor is where it is.
 */

import { palettes } from "../lib/palettes";
import type { TemplateDefinition } from "../lib/template-types";

export const creativeCanvas: TemplateDefinition = {
  id: "creative-canvas",
  name: "Creative Canvas",
  description:
    "Full-height colour sidebar with filled section bars. For portfolios that are allowed to be seen.",
  category: "creative",
  layout: "sidebar-left",
  tokens: {
    headingFont: "geist",
    bodyFont: "inter",
    sectionTitle: "bar",
    uppercaseSectionTitles: true,
    sectionTitleTracking: 0.08,
    nameScale: 2.3,
    headlineScale: 1.08,
    sectionTitleScale: 0.85,
    density: 1.05,
    bullet: "disc",
    itemDivider: false,
    headerAlign: "left",
    asideWidthPct: 36,
    asideFill: "solid",
  },
  palettes: palettes("plum", "rose", "teal", "amber", "indigo"),
};
