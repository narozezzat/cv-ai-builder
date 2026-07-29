/**
 * The public, client-safe surface of the template feature.
 *
 * `eslint-plugin-boundaries` lets `app` and other features reach this file (or `server.ts`)
 * and nothing else under `features/templates`, which is what keeps the render tree free to
 * change shape: layouts, atoms, and the registry's internals are all private. What crosses
 * the line is a renderer, a resolver, and the catalogue a picker needs.
 *
 * **Nothing re-exported here may reach an `import "server-only"` module.** Client
 * components import this barrel for the registry — `resume-card.tsx` for
 * `getTemplateDefinition`, `resume-preview.tsx` for `ResumeRenderer` — and a barrel is a
 * module, not a menu: one server-only import anywhere in it fails the client build for all
 * of them. The queries and the async sections that read them live in `server.ts`.
 */

export { toggleTemplateFavoriteAction } from "./actions/template-actions";
export { ResumeRenderer, type ResumeRendererProps } from "./components/resume-renderer";
export { ScaledPage, type ScaledPageProps } from "./components/scaled-page";
export { TemplateThumbnail, type TemplateThumbnailProps } from "./components/template-thumbnail";
export { sampleResumeInput, SAMPLE_RESUME_DOCUMENT } from "./lib/sample-document";
export { resumeFontFamily, RESUME_FONT_FAMILIES } from "./lib/fonts";
export {
  filterTemplates,
  galleryCategoryOptions,
  type GalleryCategoryOption,
  type GalleryTemplate,
} from "./lib/gallery";
export { templateGalleryHref } from "./lib/gallery-url";
export {
  formatResumeDate,
  formatResumeDateRange,
  PRESENT_LABEL,
  type ResumeDateRange,
} from "./lib/format-resume-date";
export {
  mmToPx,
  ptToPx,
  resolveTemplate,
  type ResolvedTemplate,
  type ResolveTemplateInput,
} from "./lib/resolve-template";
export {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_LAYOUTS,
  type TemplateCategory,
  type TemplateDefinition,
  type TemplateLayoutId,
  type TemplatePalette,
  type TemplateTokens,
} from "./lib/template-types";
export { DEFAULT_TEMPLATE, getTemplateDefinition, isKnownTemplateId, TEMPLATES } from "./registry";
export {
  DEFAULT_TEMPLATE_GALLERY_FILTERS,
  hasActiveTemplateFilters,
  parseTemplateGalleryFilters,
  templateIdSchema,
  TEMPLATE_SEARCH_MAX,
  type TemplateGalleryFilters,
} from "./schema/template-schema";
