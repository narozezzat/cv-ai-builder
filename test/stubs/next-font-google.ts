/**
 * `next/font/google`, for Vitest.
 *
 * The real loaders are not modules that run at import time — they are compiled away
 * by the `next-font-loader` SWC transform, which downloads the faces and rewrites the
 * call into a static object. Vitest has no such transform, so importing the real
 * package throws
 *
 *   "Cannot find module 'next/font/google'" / "next/font error: Font loader values
 *   must be explicitly written literals"
 *
 * before a single assertion runs. Anything that transitively imports
 * `features/templates/lib/fonts.ts` needs this alias.
 *
 * The shape is what the loaders return, and `fontFamily` carries the family's name so
 * a test can still assert *which* font a template resolved to — a stub that returned a
 * constant would make `resolveTemplate`'s font pairing untestable.
 */

interface FontResult {
  className: string;
  variable: string;
  style: { fontFamily: string; fontStyle?: string; fontWeight?: number };
}

function loader(family: string) {
  const name = family.replace(/_/g, " ");

  return function load(): FontResult {
    return {
      className: `__${family}`,
      variable: `--font-${family.toLowerCase().replace(/_/g, "-")}`,
      style: { fontFamily: `"${name}", sans-serif` },
    };
  };
}

export const Geist = loader("Geist");
export const IBM_Plex_Sans = loader("IBM_Plex_Sans");
export const Inter = loader("Inter");
export const JetBrains_Mono = loader("JetBrains_Mono");
export const Lato = loader("Lato");
export const Lora = loader("Lora");
export const Merriweather = loader("Merriweather");
export const Playfair_Display = loader("Playfair_Display");
export const Source_Sans_3 = loader("Source_Sans_3");
export const Source_Serif_4 = loader("Source_Serif_4");
