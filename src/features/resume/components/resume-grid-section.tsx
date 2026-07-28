import { SkeletonCard } from "@/components/shared";

import { listFolders, listResumes } from "../queries/resume-queries";
import { type ResumeListFilters } from "../schema/resume-schema";
import { ResumeGrid } from "./resume-grid";

interface ResumeGridSectionProps {
  filters: ResumeListFilters;
}

/**
 * The list itself — the only part of the page that depends on the filters.
 *
 * That is why the page keys this boundary and nothing else: a filter change should
 * show a skeleton where the cards are, while the header, the folder rail, and the
 * focused search input stay exactly where they were.
 */
export async function ResumeGridSection({ filters }: ResumeGridSectionProps) {
  const [resumes, folders] = await Promise.all([listResumes(filters), listFolders()]);

  return <ResumeGrid resumes={resumes} folders={folders} filters={filters} />;
}

/**
 * Six cards in the grid's own breakpoints.
 *
 * Not `SkeletonGrid`: that one is `lg:grid-cols-3`, and this grid goes three-up only
 * at `xl` because it sits beside the folder rail.
 */
export function ResumeGridSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading your resumes"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
