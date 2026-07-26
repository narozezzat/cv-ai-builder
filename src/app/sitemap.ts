import type { MetadataRoute } from "next";

import { routes } from "@/lib/routes";
import { absoluteUrl } from "@/lib/site";

/**
 * Sitemap.
 *
 * Only routes that actually resolve are listed, and only public ones: the auth
 * screens set `robots: noindex` on purpose, so advertising them here would be a
 * sitemap arguing with the pages it points at. Public share pages
 * (`/r/[slug]`) are user content and stay out by design: they are opt-in indexed
 * per resume, so listing them here would override that choice.
 *
 * `lastModified` uses the build timestamp. That is honest for a static marketing
 * page: it changes exactly when the deployed content changes.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: absoluteUrl(routes.home),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl(routes.terms),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: absoluteUrl(routes.privacy),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
