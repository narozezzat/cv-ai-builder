"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog, EmptyState } from "@/components/shared";
import { isActionFailure } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { type ResumeSummary } from "@/types/db";
import { formatRelativeTime } from "@/utils/date";

import { deleteResumeAction, restoreResumeAction } from "../actions/resume-actions";

interface TrashListProps {
  resumes: ResumeSummary[];
}

/**
 * Trashed resumes with restore and permanent-delete.
 *
 * A list rather than the card grid on purpose: these are not documents you can
 * work on, so giving them the same visual weight as live resumes invites clicking
 * into one and finding a dead end. Rows also make the retention notice — the only
 * thing the user needs to read here — the loudest element.
 */
export function TrashList({ resumes }: TrashListProps) {
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<ResumeSummary | null>(null);

  function restore(resume: ResumeSummary) {
    startTransition(async () => {
      const result = await restoreResumeAction({ resumeId: resume.id });

      if (isActionFailure(result)) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message ?? "Resume restored.");
    });
  }

  async function confirmDelete() {
    if (!deleting) return;

    const result = await deleteResumeAction({ resumeId: deleting.id });

    if (isActionFailure(result)) {
      toast.error(result.error);
      throw new Error(result.error);
    }

    toast.success(result.message ?? "Resume deleted permanently.");
    setDeleting(null);
  }

  if (resumes.length === 0) {
    return (
      <EmptyState
        icon={Trash2}
        title="Trash is empty"
        description="Resumes you move to the trash appear here, and can be restored until you delete them permanently."
      />
    );
  }

  return (
    <>
      <ul
        aria-label="Trashed resumes"
        className="divide-y divide-border/60 overflow-hidden rounded-xl ring-1 ring-foreground/5"
      >
        {resumes.map((resume) => {
          const trashedAt = formatRelativeTime(resume.deleted_at);

          return (
            <li
              key={resume.id}
              className="flex flex-wrap items-center gap-3 bg-card px-4 py-3 sm:flex-nowrap"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{resume.title}</p>
                <p className="text-xs text-muted-foreground">
                  {trashedAt && resume.deleted_at ? (
                    <>
                      Trashed <time dateTime={resume.deleted_at}>{trashedAt}</time>
                    </>
                  ) : (
                    "Trashed"
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => restore(resume)}
                >
                  <RotateCcw data-icon="inline-start" />
                  Restore
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleting(resume)}
                >
                  <Trash2 data-icon="inline-start" />
                  Delete
                  <span className="sr-only"> {resume.title} permanently</span>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        icon={Trash2}
        tone="destructive"
        title="Delete permanently?"
        description={
          deleting
            ? `"${deleting.title}" and its version history are deleted for good. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete permanently"
        onConfirm={confirmDelete}
      />
    </>
  );
}
