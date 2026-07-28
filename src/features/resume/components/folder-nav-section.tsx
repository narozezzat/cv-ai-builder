import { ShimmerSkeleton } from "@/components/shared";

import { getResumeCounts, listFolders } from "../queries/resume-queries";
import { type ResumeListFilters } from "../schema/resume-schema";
import { FolderNav } from "./folder-nav";

interface FolderNavSectionProps {
  filters: ResumeListFilters;
}

/**
 * The folder rail with its own reads.
 *
 * Both are independent of the grid's filters — the counts are deliberately
 * unfiltered — so this boundary is not keyed and stays mounted across a search.
 * `listFolders` is memoized, so the grid's "move to folder" menu reuses this result.
 */
export async function FolderNavSection({ filters }: FolderNavSectionProps) {
  const [folders, counts] = await Promise.all([listFolders(), getResumeCounts()]);

  return (
    <FolderNav
      folders={folders}
      filters={filters}
      totalCount={counts.total}
      unfiledCount={counts.unfiled}
    />
  );
}

/** Five rows at the rail's real row height. */
export function FolderNavSkeleton() {
  return (
    <div role="status" aria-label="Loading your folders" className="space-y-2">
      {Array.from({ length: 5 }, (_, index) => (
        <ShimmerSkeleton key={index} className="h-8 w-full rounded-md" />
      ))}
    </div>
  );
}
