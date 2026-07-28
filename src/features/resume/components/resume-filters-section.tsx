import { ShimmerSkeleton } from "@/components/shared";

import { listResumeTags } from "../queries/resume-queries";
import { type ResumeListFilters } from "../schema/resume-schema";
import { ResumeFilters } from "./resume-filters";

interface ResumeFiltersSectionProps {
  filters: ResumeListFilters;
}

/**
 * The list controls, streamed because the tag list is an aggregate over every
 * resume the user owns.
 *
 * Its boundary must not be keyed on the filters: remounting this would unmount the
 * search input mid-keystroke and take the caret with it.
 */
export async function ResumeFiltersSection({ filters }: ResumeFiltersSectionProps) {
  const tags = await listResumeTags();

  return <ResumeFilters filters={filters} tags={tags} />;
}

/** Search box plus the two selects, at control height. */
export function ResumeFiltersSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading filters"
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <ShimmerSkeleton className="h-9 w-full rounded-lg sm:max-w-xs" />
      <ShimmerSkeleton className="h-9 w-32 rounded-lg" />
      <ShimmerSkeleton className="h-9 w-32 rounded-lg" />
    </div>
  );
}
