/**
 * The public surface of the template feature.
 *
 * `eslint-plugin-boundaries` lets `app` and other features reach this file and nothing
 * else under `features/templates`, which is what keeps the render tree free to change
 * shape: layouts, atoms, and the registry's internals are all private. What crosses the
 * line is a renderer, a resolver, and the catalogue a picker needs.
 */

export { ResumeRenderer, type ResumeRendererProps } from "./components/resume-renderer";
export { resumeFontFamily, RESUME_FONT_FAMILIES } from "./lib/fonts";
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
