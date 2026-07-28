import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { AsyncBoundary, ButtonLink, PageHeader } from "@/components/shared";
import {
  CreateResumeButton,
  FolderNavSection,
  FolderNavSkeleton,
  ResumeFiltersSection,
  ResumeFiltersSkeleton,
  ResumeGridSection,
  ResumeGridSkeleton,
  TrashCountBadge,
  parseResumeListFilters,
  resumeListHref,
} from "@/features/resume";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Resumes",
  description: "Every resume you have built, with search, tags, and folders.",
  robots: { index: false, follow: false },
};

interface ResumesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResumesPage({ searchParams }: ResumesPageProps) {
  // Parsed, not read directly: `searchParams` is user input, and every filter
  // reaches a database predicate. `parseResumeListFilters` is the only thing
  // standing between a hand-edited URL and an invalid query.
  //
  // This is the page's only `await` — the four reads it used to gather here now
  // stream inside their own boundaries below, so the header and the two-column
  // frame paint before any of them resolve.
  const filters = parseResumeListFilters(await searchParams);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Resumes"
        description="Search, tag, and organise everything you have built."
        actions={
          <>
            <ButtonLink href={routes.trash} variant="outline">
              <Trash2 data-icon="inline-start" />
              Trash
              {/* Bare `Suspense`, not `AsyncBoundary`: the error fallback is a
                  full `role="alert"` card, and rendering one inside a link's
                  label would be worse than showing no count at all. */}
              <Suspense fallback={null}>
                <TrashCountBadge />
              </Suspense>
            </ButtonLink>
            <CreateResumeButton />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Above the grid in the DOM, so keyboard and screen-reader users reach
            the folder switcher before the list it filters. */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <AsyncBoundary pending={<FolderNavSkeleton />}>
            <FolderNavSection filters={filters} />
          </AsyncBoundary>
        </aside>

        <div className="min-w-0 space-y-4">
          {/* Unkeyed on purpose: the filter bar owns the focused search input, and
              remounting it mid-keystroke would take the caret with it. */}
          <AsyncBoundary pending={<ResumeFiltersSkeleton />}>
            <ResumeFiltersSection filters={filters} />
          </AsyncBoundary>

          {/* Keyed, unlike its siblings: a filter change means these results are
              stale, so the boundary should remount and fall back to the skeleton
              rather than leave the previous list on screen looking current. */}
          <AsyncBoundary key={resumeListHref(filters)} pending={<ResumeGridSkeleton />}>
            <ResumeGridSection filters={filters} />
          </AsyncBoundary>
        </div>
      </div>
    </div>
  );
}
