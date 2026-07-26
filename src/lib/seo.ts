import { absoluteUrl, siteConfig } from "@/lib/site";

/**
 * Schema.org builders.
 *
 * Structured data is typed here rather than hand-written per page so the
 * `@context`/`@id` wiring is stated once. The `@id` values are what let the
 * graph nodes reference each other instead of duplicating the organisation
 * block into every page's JSON.
 */

/** Loose but non-`any` shape: schema.org nodes are open-ended by design. */
export type JsonLdNode = Record<string, unknown>;

const ORGANIZATION_ID = absoluteUrl("/#organization");
const WEBSITE_ID = absoluteUrl("/#website");

export function organizationSchema(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: siteConfig.name,
    url: siteConfig.url,
    logo: absoluteUrl("/opengraph-image"),
    sameAs: [siteConfig.links.twitter, siteConfig.links.github],
  };
}

export function websiteSchema(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    inLanguage: "en",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/**
 * `SoftwareApplication` is what earns the rich result for a web app. `offers`
 * states the free tier truthfully — a `price: 0` claim on a paid-only product is
 * a manual-action risk, so this must stay in step with real pricing.
 */
export function softwareApplicationSchema(): JsonLdNode {
  return {
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    url: siteConfig.url,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    description: siteConfig.description,
    publisher: { "@id": ORGANIZATION_ID },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Build, edit, and export resumes for free. AI generation runs on credits.",
    },
  };
}

export function faqSchema(items: readonly { question: string; answer: string }[]): JsonLdNode {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function breadcrumbSchema(items: readonly { name: string; path: string }[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** Wraps nodes into a single `@graph` document so one script tag carries them all. */
export function jsonLdGraph(...nodes: JsonLdNode[]): JsonLdNode {
  return { "@context": "https://schema.org", "@graph": nodes };
}
