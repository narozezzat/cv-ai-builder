import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

import { AsyncBoundary, ButtonLink, PageHeader } from "@/components/shared";
import {
  EmptyTrashSection,
  EmptyTrashSkeleton,
  TrashListSection,
  TrashListSkeleton,
} from "@/features/resume";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Trash",
  description: "Restore a deleted resume, or remove it for good.",
  robots: { index: false, follow: false },
};

export default function TrashPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow={
          <ButtonLink href={routes.resumes} variant="link" size="sm" className="h-auto p-0">
            <ArrowLeft data-icon="inline-start" />
            Back to resumes
          </ButtonLink>
        }
        title="Trash"
        description="Resumes here keep their version history until you delete them permanently."
        // Its own boundary: the "Empty trash" button only needs a count, which is a
        // far cheaper read than the list, so it should not wait on it.
        actions={
          <AsyncBoundary pending={<EmptyTrashSkeleton />}>
            <EmptyTrashSection />
          </AsyncBoundary>
        }
      />

      <AsyncBoundary pending={<TrashListSkeleton />}>
        <TrashListSection />
      </AsyncBoundary>
    </div>
  );
}
