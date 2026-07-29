/**
 * The server half of the template feature's public surface.
 *
 * Split from `index.ts` rather than merged into it: these modules reach
 * `queries/template-queries.ts`, which is `import "server-only"`, and the barrel is imported
 * by client components for the registry. Webpack resolves a barrel as one module, so a
 * single server-only import in `index.ts` fails the client build for every one of them.
 *
 * Only `app` may import this file, and only from a Server Component. The skeletons travel
 * with their sections because `loading.tsx` and the `AsyncBoundary` fallbacks must stay in
 * step with the shapes they stand in for.
 */

export {
  TemplateGalleryFiltersSection,
  TemplateGalleryFiltersSkeleton,
} from "./components/template-gallery-filters-section";
export {
  TemplateGallerySection,
  TemplateGallerySkeleton,
} from "./components/template-gallery-section";
export { getActiveTemplateIds, getFavoriteTemplateIds } from "./queries/template-queries";
