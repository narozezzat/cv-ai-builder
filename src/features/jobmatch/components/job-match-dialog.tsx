"use client";

/**
 * The match, as one surface.
 *
 * A dialog rather than a panel in the editor: the posting is the context for a single
 * sitting, not part of the document, and nothing here is saved. Closing discards it,
 * which is why the paste form is reachable again from the report ("Match a different
 * posting") instead of the posting being treated as resume state.
 *
 * The dialog owns `useJobMatch` and passes state down, so the form and the report stay
 * presentational and testable without a provider. It takes `resumeId` and `getDocument`
 * as props rather than reading the resume store, because `features/jobmatch` must not
 * import `features/resume` — the dependency runs the other way, and the editor is the
 * only thing that knows which resume is open.
 *
 * State is deliberately *not* reset on close. Reopening after an edit puts the user back
 * on the score they paid for, one click from a free re-check. Resetting would charge a
 * credit for closing a dialog.
 */

import { FileSearch } from "lucide-react";

import { EmptyState } from "@/components/shared";
import { AiFailureNotice } from "@/features/ai";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ResumeDocument } from "@/types/resume";

import { useJobMatch } from "../hooks/use-job-match";
import { JobDescriptionForm } from "./job-description-form";
import { JobGapsPanel } from "./job-gaps-panel";
import { MatchScoreReport } from "./match-score-report";

export interface JobMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` before the first save, in which case the usage row is unattributed. */
  resumeId: string | null;
  /** Reads the live document at scoring time — see `UseJobMatchOptions.getDocument`. */
  getDocument: () => ResumeDocument;
}

export function JobMatchDialog({ open, onOpenChange, resumeId, getDocument }: JobMatchDialogProps) {
  const {
    status,
    outcome,
    failure,
    gapsStatus,
    gaps,
    gapsFailure,
    creditsRemaining,
    match,
    rescore,
    requestGaps,
    reset,
  } = useJobMatch({ resumeId, getDocument });

  const showReport = status === "ready" && outcome !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/60 p-4 pr-12 text-left">
          <DialogTitle>Match to a job</DialogTitle>
          <DialogDescription>
            Paste a posting and your resume is scored against it. The score is computed from your
            document, not guessed — every point is explained below it.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60svh]">
          {showReport ? (
            <div className="space-y-5 p-4">
              <MatchScoreReport
                outcome={outcome}
                onRescore={rescore}
                onRequestGaps={requestGaps}
                gapsRequested={gapsStatus !== "idle"}
              />

              <JobGapsPanel
                status={gapsStatus}
                gaps={gaps}
                failure={gapsFailure}
                onRetry={requestGaps}
              />
            </div>
          ) : (
            <>
              {status === "error" && failure ? (
                <div className="p-4 pb-0">
                  {/*
                    Retry is not wired to a stored posting: the extraction failed, so
                    there is nothing held to re-send. Resubmitting the form below is the
                    retry, and the notice's own button only appears for codes where a
                    bare retry can succeed.
                  */}
                  <AiFailureNotice failure={failure} onRetry={reset} />
                </div>
              ) : null}

              <JobDescriptionForm pending={status === "loading"} onSubmit={match} />

              {status === "idle" ? (
                <EmptyState
                  size="compact"
                  icon={FileSearch}
                  title="Nothing scored yet"
                  description="The posting stays in this dialog — it is not saved to your resume, and it is not shared with anyone."
                />
              ) : null}
            </>
          )}
        </ScrollArea>

        <DialogFooter className="mx-0 mb-0 items-center border-t border-border/60 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {creditsRemaining === null
              ? "Matching a posting costs 1 AI credit."
              : `${creditsRemaining.toLocaleString()} AI credit${creditsRemaining === 1 ? "" : "s"} left.`}
          </p>

          <div className="flex items-center gap-2">
            {showReport ? (
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                Match a different posting
              </Button>
            ) : null}

            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
