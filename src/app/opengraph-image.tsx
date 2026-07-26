import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/site";

/**
 * Social card, generated at build time.
 *
 * The root layout points both `openGraph.images` and `twitter.images` at this
 * route, so it must exist or every unfurl 404s.
 *
 * Two constraints shape the markup below, both from Satori (the renderer behind
 * `ImageResponse`):
 *
 * 1. It supports a subset of CSS — flexbox only, no `oklch()`, no CSS variables,
 *    no Tailwind. So the brand colours are restated as hex here rather than read
 *    from the design tokens. That duplication is deliberate and commented at the
 *    constant; there is no way to reach into `globals.css` from this runtime.
 * 2. Any element with more than one child needs an explicit `display: flex`.
 *
 * No remote font is fetched: a build that reaches out to Google Fonts fails in a
 * sandboxed or offline CI, and the bundled default is legible at this size.
 */
export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Hex mirrors of the `--color-brand` ramp in `globals.css`. Satori cannot parse
 * `oklch()`, so these are the sRGB equivalents. If the brand hue moves, move
 * these with it.
 */
const BRAND = "#7c5cff";
const BRAND_DEEP = "#4c2fd6";
const INK = "#0b0a12";
const MUTED = "#a5a1b8";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        backgroundColor: INK,
        // A single radial wash keeps the card from reading as a flat rectangle
        // in a crowded timeline without needing an image layer.
        backgroundImage: `radial-gradient(1000px 500px at 85% -10%, ${BRAND_DEEP}, transparent)`,
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            display: "flex",
            width: 64,
            height: 64,
            borderRadius: 18,
            backgroundImage: `linear-gradient(135deg, ${BRAND}, #c04ce0)`,
          }}
        />
        <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: -0.5 }}>{siteConfig.name}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2.5,
            maxWidth: 900,
          }}
        >
          {siteConfig.tagline}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: MUTED, maxWidth: 820 }}>
          AI writing, ATS scoring, 20 templates, and real PDF export.
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 24 }}>
        <div
          style={{
            display: "flex",
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: BRAND,
          }}
        />
        <div style={{ display: "flex", color: MUTED }}>
          {siteConfig.url.replace(/^https?:\/\//, "")}
        </div>
      </div>
    </div>,
    size,
  );
}
