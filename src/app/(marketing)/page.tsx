import { JsonLd } from "@/components/shared";
import {
  CtaBand,
  FAQS,
  Faq,
  FeatureGrid,
  Hero,
  HowItWorks,
  TemplateShowcase,
} from "@/features/marketing";
import {
  faqSchema,
  jsonLdGraph,
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
} from "@/lib/seo";

/**
 * Landing page. Fully static — no `cookies()`, no `headers()`, no data fetch — so
 * Next prerenders it at build time and it is served from the edge cache.
 *
 * Title and description are inherited from the root layout's metadata, which
 * already carries the default title, OpenGraph, and Twitter blocks. Restating
 * them here would only create two places to keep in step.
 */
export default function HomePage() {
  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          organizationSchema(),
          websiteSchema(),
          softwareApplicationSchema(),
          faqSchema(FAQS),
        )}
      />
      <Hero />
      <FeatureGrid />
      <HowItWorks />
      <TemplateShowcase />
      <Faq />
      <CtaBand />
    </>
  );
}
