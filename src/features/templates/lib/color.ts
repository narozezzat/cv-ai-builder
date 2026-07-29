/**
 * Palette arithmetic, in hex only.
 *
 * The layouts that fill a band or a column with a solid colour need one shade the palette
 * does not carry: the muted text and hairline that read correctly *on* that fill. Both are
 * derivable — a blend of the fill's text colour toward the fill itself — so they are
 * computed rather than added to every one of twenty configs as two more hand-picked hex
 * strings that could disagree.
 *
 * Output is always a 6-digit `#rrggbb`. Not `rgba()` and not 8-digit hex: the same value
 * is interpolated into inline styles read by Chromium's print path and by Satori, and it
 * has to satisfy `HEX_COLOR_PATTERN` for the same reason `theme.accent` does.
 */

const HEX = /^#([0-9a-fA-F]{6})$/;

/** Last-resort colour. Reached only if a caller passes two unparseable strings. */
const FALLBACK = "#000000";

/**
 * `from` blended `ratio` of the way toward `to`. `0` is `from`, `1` is `to`.
 *
 * Invalid input degrades to whichever argument parsed rather than throwing: this runs
 * inside a render tree that a print route and a public share page both depend on, and a
 * malformed palette entry should cost a shade, not a page.
 */
export function mixHex(from: string, to: string, ratio: number): string {
  const start = parseHex(from);
  const end = parseHex(to);

  if (!start || !end) {
    return start ? format(start) : end ? format(end) : FALLBACK;
  }

  // `NaN` survives `Math.min`/`Math.max`, and a `NaN` channel formats as the literal
  // string "nan" — a value that passes straight into an inline style and paints nothing.
  const t = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;

  return format([
    start[0] + (end[0] - start[0]) * t,
    start[1] + (end[1] - start[1]) * t,
    start[2] + (end[2] - start[2]) * t,
  ]);
}

/**
 * WCAG contrast ratio between two hex colours, `1` (identical) to `21` (black on white).
 *
 * A resume palette is not a themeable surface — nothing at render time can rescue a
 * template that pairs pale grey text with white paper, and the page is also printed, where
 * contrast only gets worse. The registry test asserts a floor with this, which is the
 * cheapest place to catch a palette that would be unreadable.
 *
 * Unparseable input scores `1`, so a malformed colour fails a floor check rather than
 * passing one.
 */
export function contrastRatio(a: string, b: string): number {
  const first = parseHex(a);
  const second = parseHex(b);

  if (!first || !second) {
    return 1;
  }

  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));

  return (lighter + 0.05) / (darker + 0.05);
}

type Rgb = [number, number, number];

/** Relative luminance per WCAG 2.1, on the sRGB channels. */
function luminance([r, g, b]: Rgb): number {
  const [rl, gl, bl] = [r, g, b].map((value) => {
    const channelValue = value / 255;

    return channelValue <= 0.03928
      ? channelValue / 12.92
      : Math.pow((channelValue + 0.055) / 1.055, 2.4);
  }) as Rgb;

  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function parseHex(value: string): Rgb | null {
  const match = HEX.exec(value.trim());

  if (!match) {
    return null;
  }

  const int = Number.parseInt(match[1], 16);

  return [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff];
}

function format(rgb: Rgb): string {
  return `#${rgb.map(channel).join("")}`;
}

function channel(value: number): string {
  return Math.min(255, Math.max(0, Math.round(value)))
    .toString(16)
    .padStart(2, "0");
}
