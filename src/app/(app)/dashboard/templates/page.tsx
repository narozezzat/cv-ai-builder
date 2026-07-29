import type { Metadata } from "next";

import { AsyncBoundary, PageHeader } from "@/components/shared";
import { CreateResumeButton } from "@/features/resume";
import { parseTemplateGalleryFilters, templateGalleryHref } from "@/features/templates";
import {
  TemplateGalleryFiltersSection,
  TemplateGalleryFiltersSkeleton,
  TemplateGallerySection,
  TemplateGallerySkeleton,
} from "@/features/templates/server";

export const metadata: Metadata = {
  title: "Templates",
  description: "Twenty resume templates, each with several colour palettes.",
  robots: { index: false, follow: false },
};

interface TemplatesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TemplatesPage({ searchParams }: TemplatesPageProps) {
  // Parsed, never read raw: `searchParams` is user input, and a hand-edited category is
  // supposed to degrade to the full gallery rather than throw.
  //
  // The page's only `await`. Both sections read the same two cached queries inside their
  // own boundaries, so the header paints before either resolves.
  const filters = parseTemplateGalleryFilters(await searchParams);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Templates"
        description="Every template is the real renderer, so what you see here is what prints. Pick one to start, or switch at any time from the editor."
        actions={<CreateResumeButton />}
      />

      {/* Unkeyed on purpose: the filter bar owns the focused search input, and remounting
          it mid-keystroke would take the caret with it. */}
      <AsyncBoundary pending={<TemplateGalleryFiltersSkeleton />}>
        <TemplateGalleryFiltersSection filters={filters} />
      </AsyncBoundary>

      {/* Keyed, unlike its sibling: a filter change makes these results stale, so the
          boundary should fall back to the skeleton rather than leave the previous grid on
          screen looking current. */}
      <AsyncBoundary key={templateGalleryHref(filters)} pending={<TemplateGallerySkeleton />}>
        <TemplateGallerySection filters={filters} />
      </AsyncBoundary>
    </div>
  );
}
