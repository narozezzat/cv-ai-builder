/**
 * Public surface of the marketing feature.
 *
 * `src/app` may only import a feature through this file — the boundary rule in
 * `eslint.config.mjs` enforces it — so the landing route composes sections it
 * cannot reach into.
 */

export { CtaBand } from "./components/cta-band";
export { Faq } from "./components/faq";
export { FeatureGrid } from "./components/feature-grid";
export { Hero } from "./components/hero";
export { HowItWorks } from "./components/how-it-works";
export { LegalPage } from "./components/legal-page";
export { Section } from "./components/section";
export { SiteFooter } from "./components/site-footer";
export { SiteHeader } from "./components/site-header";
export { TemplateShowcase } from "./components/template-showcase";

export { FAQS, FEATURES, NAV_LINKS, STEPS, TEMPLATE_PREVIEWS } from "./content";
export { PRIVACY, TERMS } from "./legal-content";
export type { LegalDocument, LegalSection } from "./legal-content";
export type {
  FaqItem,
  FeatureItem,
  StepItem,
  TemplateLayoutPreview,
  TemplatePreview,
} from "./content";
