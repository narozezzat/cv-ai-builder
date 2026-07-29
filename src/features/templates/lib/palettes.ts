/**
 * The shared palette library.
 *
 * Twenty templates times four or more palettes is eighty colour sets. Written out per
 * template they would drift: the same "Navy" would end up three shades apart in three
 * files, and a contrast fix would have to be applied in all of them. So palettes are named
 * once here and templates *reference* them.
 *
 * A palette is deliberately not a template's identity. What makes Elegant Serif different
 * from Tech Terminal is layout, font pairing, and rhythm — not that one owns the colour
 * teal. Two templates offering the same Navy is a feature: a user who likes navy can
 * change template without losing it, because `theme.paletteId` still matches.
 *
 * Every value is a 6-digit hex (see `template-types.ts` for why), every `body` and
 * `heading` clears WCAG AA against its own `surface`, and every `onAccent` clears AA
 * against its `accent` — asserted in `palettes.test.ts`, because a palette that fails is
 * unreadable on paper where nothing can be re-themed.
 */

import type { TemplatePalette } from "./template-types";

/** Paper. Only three tinted options exist; the rest are white, because most resumes print. */
const WHITE = "#ffffff";

const PALETTE_LIST = [
  {
    id: "slate",
    name: "Slate",
    surface: WHITE,
    heading: "#0f172a",
    body: "#334155",
    muted: "#64748b",
    rule: "#e2e8f0",
    accent: "#2563eb",
    onAccent: WHITE,
  },
  {
    id: "graphite",
    name: "Graphite",
    surface: WHITE,
    heading: "#111827",
    body: "#374151",
    muted: "#6b7280",
    rule: "#e5e7eb",
    // Monochrome on purpose: some industries read any colour as informal.
    accent: "#374151",
    onAccent: WHITE,
  },
  {
    id: "ink",
    name: "Ink",
    surface: WHITE,
    heading: "#0a0a0a",
    body: "#262626",
    muted: "#585858",
    rule: "#dcdcdc",
    accent: "#0a0a0a",
    onAccent: WHITE,
  },
  {
    id: "navy",
    name: "Navy",
    surface: WHITE,
    heading: "#0f2c52",
    body: "#243b53",
    muted: "#5f7286",
    rule: "#d8e1eb",
    accent: "#14406e",
    onAccent: WHITE,
  },
  {
    id: "indigo",
    name: "Indigo",
    surface: WHITE,
    heading: "#1e1b4b",
    body: "#312e5f",
    muted: "#615d8a",
    rule: "#dedcf2",
    accent: "#4338ca",
    onAccent: WHITE,
  },
  {
    id: "emerald",
    name: "Emerald",
    surface: WHITE,
    heading: "#064e3b",
    body: "#1f2937",
    muted: "#6b7280",
    rule: "#d8e8e0",
    accent: "#047857",
    onAccent: WHITE,
  },
  {
    id: "forest",
    name: "Forest",
    surface: WHITE,
    heading: "#14342b",
    body: "#2f3e37",
    muted: "#60706a",
    rule: "#dbe5e0",
    accent: "#1f5d4c",
    onAccent: WHITE,
  },
  {
    id: "teal",
    name: "Teal",
    surface: WHITE,
    heading: "#0d3b40",
    body: "#274b4f",
    // Dark enough to clear AA on the tinted papers too, since `onPaper` can move it there.
    muted: "#587578",
    rule: "#d5e6e7",
    accent: "#0f766e",
    onAccent: WHITE,
  },
  {
    id: "plum",
    name: "Plum",
    surface: WHITE,
    heading: "#2e1065",
    body: "#3f3f46",
    muted: "#71717a",
    rule: "#e7e2f7",
    accent: "#6d28d9",
    onAccent: WHITE,
  },
  {
    id: "oxblood",
    name: "Oxblood",
    surface: WHITE,
    heading: "#4c0f1a",
    body: "#3f2b2e",
    muted: "#7a5f63",
    rule: "#ecdcde",
    accent: "#8c1d2c",
    onAccent: WHITE,
  },
  {
    id: "rose",
    name: "Rose",
    surface: WHITE,
    heading: "#4c0d3f",
    body: "#3f2b3b",
    muted: "#7d6076",
    rule: "#f0dcea",
    accent: "#a21c6b",
    onAccent: WHITE,
  },
  {
    id: "copper",
    name: "Copper",
    surface: WHITE,
    heading: "#4a2410",
    body: "#412f22",
    muted: "#7c6555",
    rule: "#ecdfd4",
    accent: "#a44c1c",
    onAccent: WHITE,
  },
  {
    id: "amber",
    name: "Amber",
    surface: WHITE,
    heading: "#432104",
    body: "#3f2e17",
    muted: "#7b6647",
    rule: "#ece0cd",
    accent: "#b45309",
    onAccent: WHITE,
  },
  {
    id: "olive",
    name: "Olive",
    surface: WHITE,
    heading: "#33350f",
    body: "#3d3f24",
    muted: "#6f7154",
    rule: "#e4e5d4",
    accent: "#5c6212",
    onAccent: WHITE,
  },
  {
    id: "sand",
    name: "Sand",
    // The warm paper. Prints as off-white and photographs warmer than pure white.
    surface: "#fdfcf9",
    heading: "#1c1917",
    body: "#44403c",
    muted: "#78716c",
    rule: "#e7e5e4",
    accent: "#b45309",
    onAccent: WHITE,
  },
  {
    id: "bone",
    name: "Bone",
    surface: "#fbfaf7",
    heading: "#232021",
    body: "#403b3c",
    muted: "#736d6e",
    rule: "#e6e2dd",
    accent: "#5b4a3f",
    onAccent: WHITE,
  },
  {
    id: "mist",
    name: "Mist",
    surface: "#f9fbfc",
    heading: "#14212b",
    body: "#31424f",
    muted: "#64757f",
    rule: "#dde6ec",
    accent: "#22637f",
    onAccent: WHITE,
  },
  {
    id: "carbon",
    name: "Carbon",
    surface: WHITE,
    heading: "#18181b",
    body: "#2f2f33",
    muted: "#63636b",
    rule: "#e0e0e3",
    // Reads as a terminal accent without becoming one: dark enough to hold white text.
    accent: "#0e7490",
    onAccent: WHITE,
  },
] as const satisfies readonly TemplatePalette[];

export type PaletteId = (typeof PALETTE_LIST)[number]["id"];

const BY_ID = new Map<PaletteId, TemplatePalette>(
  PALETTE_LIST.map((palette) => [palette.id, palette]),
);

export const PALETTES: readonly TemplatePalette[] = PALETTE_LIST;

/**
 * The palette set for a template, in offer order. The first is the default.
 *
 * Typed on `PaletteId` rather than `string` so a typo in a registry config is a compile
 * error — the alternative is a template that ships with one palette missing and no signal
 * beyond a gap in the picker.
 */
export function palettes(
  first: PaletteId,
  second: PaletteId,
  third: PaletteId,
  fourth: PaletteId,
  ...rest: PaletteId[]
): readonly [TemplatePalette, ...TemplatePalette[]] {
  return [first, second, third, fourth, ...rest].map(paletteById) as [
    TemplatePalette,
    ...TemplatePalette[],
  ];
}

/**
 * One palette, with a chosen surface. Lets a template offer "Navy, but on warm paper"
 * without a near-duplicate entry in the library.
 */
export function onPaper(id: PaletteId, surface: PaletteId): TemplatePalette {
  const base = paletteById(id);
  const paper = paletteById(surface);

  return {
    ...base,
    id: `${base.id}-${paper.id}`,
    name: `${base.name} on ${paper.name}`,
    surface: paper.surface,
    rule: paper.rule,
  };
}

function paletteById(id: PaletteId): TemplatePalette {
  const palette = BY_ID.get(id);

  if (!palette) {
    // Unreachable while `PaletteId` is derived from the list; kept so the map lookup has a
    // defined answer rather than an `as` cast that would hide a future refactor.
    throw new Error(`Unknown palette: ${id}`);
  }

  return palette;
}
