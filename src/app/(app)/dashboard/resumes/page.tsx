import { Trash2 } from "lucide-react";
import type { Metadata } from "next";

import { ButtonLink, PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import {
  CreateResumeButton,
  FolderNav,
  ResumeFilters,
  ResumeGrid,
  countTrashedResumes,
  getResumeCounts,
  listFolders,
  listResumeTags,
  listResumes,
  parseResumeListFilters,
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
  const filters = parseResumeListFilters(await searchParams);

  const [resumes, folders, tags, counts, trashedCount] = await Promise.all([
    listResumes(filters),
    listFolders(),
    listResumeTags(),
    getResumeCounts(),
    countTrashedResumes(),
  ]);

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
              {trashedCount > 0 ? (
                <Badge variant="secondary" className="ml-1">
                  {trashedCount}
                </Badge>
              ) : null}
            </ButtonLink>
            <CreateResumeButton />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Above the grid in the DOM, so keyboard and screen-reader users reach
            the folder switcher before the list it filters. */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <FolderNav
            folders={folders}
            filters={filters}
            totalCount={counts.total}
            unfiledCount={counts.unfiled}
          />
        </aside>

        <div className="min-w-0 space-y-4">
          <ResumeFilters filters={filters} tags={tags} />
          <ResumeGrid resumes={resumes} folders={folders} filters={filters} />
        </div>
      </div>
    </div>
  );
}
