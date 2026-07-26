/**
 * Static product metadata. Imported by the Metadata API, structured data,
 * sitemap, and marketing copy so the product name and URL are never duplicated
 * as string literals across the app.
 */

/**
 * Canonical origin, no trailing slash.
 *
 * Resolution order matters: an explicit `NEXT_PUBLIC_SITE_URL` wins so preview
 * deployments and self-hosted installs can pin their own domain; `VERCEL_URL`
 * covers Vercel preview builds automatically; localhost is the dev fallback.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

export const siteConfig = {
  name: "Reforge",
  shortName: "Reforge",
  tagline: "The AI resume builder that gets you interviews",
  description:
    "Build an ATS-ready resume in minutes. Reforge writes your bullet points, scores your resume against any job description, and exports a pixel-perfect PDF.",
  url: SITE_URL,
  ogImage: `${SITE_URL}/opengraph-image`,
  locale: "en_US",
  author: "Reforge",
  keywords: [
    "resume builder",
    "AI resume builder",
    "CV builder",
    "ATS resume checker",
    "resume templates",
    "cover letter generator",
    "job description matcher",
    "free resume maker",
  ],
  links: {
    twitter: "https://twitter.com/reforge",
    github: "https://github.com/reforge",
  },
} as const;

export type SiteConfig = typeof siteConfig;

/** Absolute URL builder for canonical tags, OG images, and share links. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
