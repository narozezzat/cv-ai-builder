import { ShimmerSkeleton } from "@/components/shared";

import { countTrashedResumes } from "../queries/resume-queries";
import { EmptyTrashButton } from "./empty-trash-button";

/**
 * The header's "Empty trash" action.
 *
 * Counted with `head: true` rather than reusing the list's length: the two now
 * resolve in separate boundaries, and making the header wait for every trashed row
 * to transfer would defeat the split.
 */
export async function EmptyTrashSection() {
  const count = await countTrashedResumes();

  return <EmptyTrashButton count={count} />;
}

/** Button-sized, so the header doesn't resize when the count arrives. */
export function EmptyTrashSkeleton() {
  return (
    <div role="status" aria-label="Loading trash actions">
      <ShimmerSkeleton className="h-9 w-32 rounded-lg" />
    </div>
  );
}
