import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

/**
 * Crawl rules.
 *
 * The disallow list is the important part. `/print/` renders resumes for the PDF
 * pipeline behind short-lived tokens, and `/dashboard`, `/builder`, `/settings`
 * are session-gated — a crawler that follows them only generates redirect noise.
 * Public share pages under `/r/` stay crawlable; whether an individual one is
 * indexed is decided per-page by its own `robots` metadata, which respects the
 * user's opt-in.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/print/", "/dashboard", "/builder", "/settings", "/auth/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
