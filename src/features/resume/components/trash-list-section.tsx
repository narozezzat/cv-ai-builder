import { ShimmerSkeleton } from "@/components/shared";

import { listTrashedResumes } from "../queries/resume-queries";
import { TrashList } from "./trash-list";

/** The trashed rows, streamed so the page header renders immediately. */
export async function TrashListSection() {
  const resumes = await listTrashedResumes();

  return <TrashList resumes={resumes} />;
}

/** Four rows at `TrashList`'s row height, dividers included. */
export function TrashListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the trash"
      className="divide-y divide-border/60 overflow-hidden rounded-xl ring-1 ring-foreground/5"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} aria-hidden className="flex items-center gap-3 bg-card px-4 py-3">
          <div className="flex-1 space-y-2">
            <ShimmerSkeleton className="h-4 w-52" />
            <ShimmerSkeleton className="h-3 w-24" />
          </div>
          <ShimmerSkeleton className="h-8 w-24 rounded-lg" />
          <ShimmerSkeleton className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
