/**
 * The ten typefaces a resume can be set in.
 *
 * Loaded through `next/font/google`, which self-hosts the files at build time. That
 * matters more here than anywhere else in the app: the PDF is rendered by headless
 * Chromium against our own origin, so a resume whose font came from
 * `fonts.googleapis.com` would race the network and sometimes print in a fallback.
 * Self-hosted files are on disk before the browser asks.
 *
 * `preload: false` on all of them — a resume uses one heading font and one body font,
 * and preloading twenty families to use two is how you make a fast page slow. `swap`
 * so text is never invisible while a face loads.
 *
 * Consumed as `.style.fontFamily` (an inline `font-family` string, fallback stack
 * included) rather than as a `className`. Inline is what the print route and the
 * preview both need: the resolved family has to travel with the element, not with a
 * class that lives in a stylesheet a Puppeteer navigation may or may not have applied.
 */

import {
  Geist,
  IBM_Plex_Sans,
  Inter,
  JetBrains_Mono,
  Lato,
  Lora,
  Merriweather,
  Playfair_Display,
  Source_Sans_3,
  Source_Serif_4,
} from "next/font/google";

import { RESUME_FONTS, type ResumeFont } from "@/types/resume";

/**
 * Every family here is variable except Lato, which ships static instances only and so
 * names its weights. Italics are requested explicitly wherever the family has them:
 * rich text emits `<em>`, and a synthesised oblique looks like a rendering bug at print
 * resolution. Geist has no italic on Google Fonts, hence its single style.
 */
const inter = Inter({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});
const geist = Geist({ subsets: ["latin"], display: "swap", preload: false });
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});
const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});
const sourceSans3 = Source_Sans_3({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});
const merriweather = Merriweather({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});
const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});
const lora = Lora({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

/** `font-family` strings, keyed by the id the theme stores. */
export const RESUME_FONT_FAMILIES: Record<ResumeFont, string> = {
  inter: inter.style.fontFamily,
  geist: geist.style.fontFamily,
  "ibm-plex-sans": ibmPlexSans.style.fontFamily,
  lato: lato.style.fontFamily,
  "source-sans-3": sourceSans3.style.fontFamily,
  merriweather: merriweather.style.fontFamily,
  "source-serif-4": sourceSerif4.style.fontFamily,
  lora: lora.style.fontFamily,
  "playfair-display": playfairDisplay.style.fontFamily,
  "jetbrains-mono": jetBrainsMono.style.fontFamily,
};

/**
 * Falls back to the first font rather than throwing. A template registry entry is
 * typed, so the only way to get here with an unknown id is a hand-edited database row,
 * and a resume that opens in the wrong typeface beats one that does not open.
 */
export function resumeFontFamily(font: ResumeFont): string {
  return RESUME_FONT_FAMILIES[font] ?? RESUME_FONT_FAMILIES[RESUME_FONTS[0]];
}
