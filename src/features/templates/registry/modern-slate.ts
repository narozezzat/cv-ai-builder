/**
 * Modern Slate — the default.
 *
 * Uppercase tracked section titles over a hairline rule, a large name, single column.
 * It is the default because it is the safest thing to open a blank resume into: every
 * ATS parses a single column correctly, and nothing about it has to be undone before it
 * can be sent to a human.
 */

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
  },
  palettes: [
    {
      id: "slate",
      name: "Slate",
      surface: "#ffffff",
      heading: "#0f172a",
      body: "#334155",
      muted: "#64748b",
      rule: "#e2e8f0",
      accent: "#2563eb",
      onAccent: "#ffffff",
    },
    {
      id: "graphite",
      name: "Graphite",
      surface: "#ffffff",
      heading: "#111827",
      body: "#374151",
      muted: "#6b7280",
      rule: "#e5e7eb",
      // Monochrome on purpose: some industries read any colour as informal.
      accent: "#374151",
      onAccent: "#ffffff",
    },
    {
      id: "emerald",
      name: "Emerald",
      surface: "#ffffff",
      heading: "#064e3b",
      body: "#1f2937",
      muted: "#6b7280",
      rule: "#d8e8e0",
      accent: "#047857",
      onAccent: "#ffffff",
    },
    {
      id: "plum",
      name: "Plum",
      surface: "#ffffff",
      heading: "#2e1065",
      body: "#3f3f46",
      muted: "#71717a",
      rule: "#e7e2f7",
      accent: "#6d28d9",
      onAccent: "#ffffff",
    },
    {
      id: "sand",
      name: "Sand",
      // The one tinted paper. Prints as off-white and photographs warmer than #fff.
      surface: "#fdfcf9",
      heading: "#1c1917",
      body: "#44403c",
      muted: "#78716c",
      rule: "#e7e5e4",
      accent: "#b45309",
      onAccent: "#ffffff",
    },
  ],
};
