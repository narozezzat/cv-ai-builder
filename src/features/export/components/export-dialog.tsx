"use client";

/**
 * Download: pick a format, wait for Chromium, get the file.
 *
 * Three details drive the shape of this component.
 *
 * **The render reads the stored row, not the editor.** Puppeteer navigates to
 * `/print/[token]` with an empty profile — it cannot see the Zustand draft. So an
 * unsaved edit would print as it was before, silently and expensively. The dialog
 * therefore flushes the editor's pending write *first* and refuses to render if that
 * write fails, which is the only reason it takes `dirty` and `onFlush` instead of
 * calling the action straight away.
 *
 * **The wait is long enough to need a state, not a spinner on a button.** A cold
 * Chromium launch plus a font wait is seconds, so the dialog says which stage it is in
 * and disables the controls, rather than letting a second click open a second browser.
 *
 * **The link is a bearer token.** The action hands back a signed URL to one private
 * object with a five-minute life. Nothing here stores it, the download fires as soon as
 * it arrives, and the visible button exists because a programmatic click can be
 * blocked — a dead end with no button would look like a failed export.
 */

import { Download, FileDown } from "lucide-react";
import { useId, useState } from "react";

import { Spinner } from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { exportResume, type ExportResumeResult } from "../actions/export-resume";
import {
  DEFAULT_IMAGE_SCALE,
  EXPORT_FORMAT_DEFINITIONS,
  EXPORT_FORMAT_ORDER,
  IMAGE_SCALES,
  IMAGE_SCALE_LABELS,
  supportsImageScale,
  type ExportFormat,
  type ImageScale,
} from "../lib/export-formats";
import { EXPORT_SIGNED_URL_TTL_SECONDS } from "../lib/storage";

/** The successful branch of the action's result, which is what the ready state renders. */
type CompletedExport = Extract<ExportResumeResult, { ok: true }>;

type Status = "idle" | "saving" | "rendering" | "ready" | "error";

const UNSAVED_FAILED =
  "Your latest edits could not be saved, so the download would not include them. Fix the save first.";
const UNSAVED_RESUME =
  "Save this resume once before downloading it — the file is rendered from the saved copy.";

const LINK_MINUTES = Math.round(EXPORT_SIGNED_URL_TTL_SECONDS / 60);

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` before the first save. There is no row to render, so the dialog says so. */
  resumeId: string | null;
  /** True while the editor holds edits the server has not seen. */
  dirty: boolean;
  /**
   * Flushes those edits, resolving `false` if the write failed or conflicted. Passed in
   * rather than called from here because `features/export` must not import
   * `features/resume` — the editor owns the save.
   */
  onFlush: () => Promise<boolean>;
}

export function ExportDialog({ open, onOpenChange, resumeId, dirty, onFlush }: ExportDialogProps) {
  const id = useId();
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [scale, setScale] = useState<ImageScale>(DEFAULT_IMAGE_SCALE);
  const [status, setStatus] = useState<Status>("idle");
  const [completed, setCompleted] = useState<CompletedExport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = status === "saving" || status === "rendering";

  async function handleExport(): Promise<void> {
    if (!resumeId || busy) return;

    setError(null);
    setCompleted(null);

    if (dirty) {
      setStatus("saving");

      if (!(await onFlush())) {
        setStatus("error");
        setError(UNSAVED_FAILED);

        return;
      }
    }

    setStatus("rendering");

    try {
      const result = await exportResume({ resumeId, format, scale });

      if (!result.ok) {
        setStatus("error");
        setError(result.error);

        return;
      }

      setCompleted(result);
      setStatus("ready");
      startDownload(result.url, result.fileName);
    } catch (cause) {
      // A rejected action is a network or runtime failure — the action itself returns
      // its errors. Nothing from `cause` is shown: it can carry an internal URL.
      console.error("[export] action threw", cause);
      setStatus("error");
      setError("Something went wrong while preparing the file. Try again.");
    }
  }

  /*
    Changing either control invalidates the file already produced. Clearing the ready
    state rather than leaving it is the point: "Downloaded resume.pdf" sitting under a
    freshly selected PNG describes a file the user did not ask for.
  */
  function handleFormatChange(next: ExportFormat): void {
    setFormat(next);
    setCompleted(null);
    setError(null);
    setStatus("idle");
  }

  return (
    <Dialog
      open={open}
      // A render in flight owns a Chromium process and a half-written row; closing the
      // dialog would leave both running with nothing to report back to.
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download</DialogTitle>
          <DialogDescription>
            Rendered on the server from the saved copy of this resume, in the template and colors
            you chose.
          </DialogDescription>
        </DialogHeader>

        {/* One fieldset for both groups so `busy` disables every control in one place. */}
        <fieldset disabled={busy} className="space-y-4">
          <div className="space-y-2">
            <p id={`${id}-format`} className="text-sm font-medium">
              Format
            </p>

            <RadioGroup
              value={format}
              disabled={busy}
              aria-labelledby={`${id}-format`}
              // Base UI types the value as `unknown` because a radio value can be any
              // serialisable thing. The set is closed here, so the narrowing is safe.
              onValueChange={(next) => handleFormatChange(next as ExportFormat)}
              className="gap-1"
            >
              {EXPORT_FORMAT_ORDER.map((candidate) => {
                const definition = EXPORT_FORMAT_DEFINITIONS[candidate];
                const optionId = `${id}-${candidate}`;

                return (
                  <div
                    key={candidate}
                    className="flex items-start gap-2.5 rounded-lg border border-border/60 p-3 has-data-checked:border-brand has-data-checked:bg-brand/5"
                  >
                    <RadioGroupItem id={optionId} value={candidate} className="mt-0.5" />

                    <div className="space-y-0.5">
                      <Label htmlFor={optionId} className="font-medium">
                        {definition.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{definition.description}</p>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/*
            Hidden, not disabled, for PDF: `deviceScaleFactor` does nothing to vector
            output, and a greyed control invites the user to wonder what they are missing.
          */}
          {supportsImageScale(format) ? (
            <div className="space-y-2">
              <p id={`${id}-quality`} className="text-sm font-medium">
                Quality
              </p>

              <ToggleGroup
                variant="outline"
                spacing={0}
                disabled={busy}
                aria-labelledby={`${id}-quality`}
                className="w-fit max-w-full flex-wrap"
                value={[String(scale)]}
                onValueChange={(groupValue) => {
                  const next = Number(groupValue[0]);

                  // Base UI clears the array when the active item is pressed again, and
                  // an image always renders at some density.
                  if (isImageScale(next)) {
                    setScale(next);
                    setCompleted(null);
                    setStatus("idle");
                  }
                }}
              >
                {IMAGE_SCALES.map((candidate) => (
                  <ToggleGroupItem key={candidate} value={String(candidate)}>
                    {IMAGE_SCALE_LABELS[candidate]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <p className="text-xs text-muted-foreground">
                An image captures the first page only. Send employers the PDF.
              </p>
            </div>
          ) : null}
        </fieldset>

        {resumeId === null ? (
          <Alert>
            <AlertTitle>Not saved yet</AlertTitle>
            <AlertDescription>{UNSAVED_RESUME}</AlertDescription>
          </Alert>
        ) : null}

        {status === "error" && error ? (
          <Alert variant="destructive">
            <AlertTitle>Download failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {status === "ready" && completed ? (
          <Alert>
            <AlertTitle>{completed.fileName}</AlertTitle>
            <AlertDescription className="space-y-2">
              <span>
                {describeFile(completed)} The link works for {LINK_MINUTES} minutes.
              </span>

              {/*
                A real link, not a second action call: re-rendering to recover from a
                blocked click would charge another Chromium launch for a file that exists.

                Styled with `buttonVariants` rather than `<Button render={<a />} />`, for the
                reason spelled out in `ButtonLink` — Base UI's Button enforces native button
                semantics and warns when what it renders is not one. The URL is Supabase's,
                so this is not a `next/link` either.
              */}
              <a
                href={completed.url}
                download={completed.fileName}
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Download aria-hidden className="size-3.5" />
                Download again
              </a>
            </AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={busy || resumeId === null}
            onClick={handleExport}
          >
            {busy ? (
              <>
                <Spinner size="xs" />
                {status === "saving" ? "Saving…" : "Rendering…"}
              </>
            ) : (
              <>
                <FileDown aria-hidden className="size-3.5" />
                {status === "ready" ? "Download again" : "Download"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Starts the download without navigating.
 *
 * The signed URL already carries `Content-Disposition: attachment`, so the `download`
 * attribute is belt to that brace — it is ignored cross-origin. Appending the anchor
 * before clicking is what makes this work in Firefox, which ignores a click on a node
 * that is not in the document.
 */
function startDownload(url: string, fileName: string): void {
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/** "412 KB · 2 pages." — what arrived, so a one-page render of a two-page resume is visible. */
function describeFile({ sizeBytes, pageCount }: CompletedExport): string {
  const size = `${Math.max(1, Math.round(sizeBytes / 1024)).toLocaleString()} KB`;

  if (pageCount === null) {
    return `${size}.`;
  }

  return `${size} · ${pageCount} page${pageCount === 1 ? "" : "s"}.`;
}

function isImageScale(value: number): value is ImageScale {
  return IMAGE_SCALES.some((scale) => scale === value);
}
