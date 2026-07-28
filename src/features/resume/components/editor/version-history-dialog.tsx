"use client";

/**
 * Version history: pick a snapshot, read what restoring it would change, restore it.
 *
 * The diff is the confirmation surface, which is why there is no second "are you
 * sure" step. A confirmation that repeats the button's own label adds a click and no
 * information; a list of the fields about to change adds information and no doubt.
 * Restoring is also recoverable twice over — the server snapshots the current state
 * before handing back the old one, and the client installs it through
 * `replaceDocument`, so `Cmd+Z` undoes it like any other edit.
 *
 * Fetches on open rather than with the editor. History is a rarely-opened panel, and
 * loading every snapshot's metadata into the editor's initial payload would tax every
 * session for the few that use it.
 *
 * `before` for the diff is the stored snapshot and `after` is the editor's current
 * document, so the entries read as "what you would lose". The column headings say so
 * explicitly — a diff whose direction the reader has to infer is a diff that will be
 * misread in the one case where it matters.
 */

import { AlertCircle, History, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState, Spinner } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import type { ResumeDocument } from "@/types/resume";
import { formatDateTime, formatRelativeTime } from "@/utils/date";

import {
  listResumeVersionsAction,
  readResumeVersionAction,
  restoreResumeVersionAction,
  type ResumeVersionSummary,
} from "../../actions/resume-actions";
import { type DiffEntry, diffResumeDocuments } from "../../lib/diff-document";
import { VERSION_ORIGIN_LABELS } from "../../schema/resume-schema";
import { selectDocument, useResumeStore } from "../../store/resume-store";

export interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ListState =
  | { status: "loading" }
  | { status: "ready"; versions: ResumeVersionSummary[] }
  | { status: "error"; message: string };

/**
 * Every non-idle state carries `versionId`, so the list highlight and the retry
 * button both have something to point at without narrowing on the state's shape.
 */
type SelectionState =
  | { status: "idle" }
  | { status: "loading"; versionId: string }
  | { status: "ready"; versionId: string; version: ResumeVersionSummary; document: ResumeDocument }
  | { status: "error"; versionId: string; message: string };

const DIFF_KIND_LABELS: Record<DiffEntry["kind"], string> = {
  added: "Added",
  removed: "Removed",
  changed: "Changed",
};

export function VersionHistoryDialog({ open, onOpenChange }: VersionHistoryDialogProps) {
  const resumeId = useResumeStore((state) => state.resumeId);
  const currentDocument = useResumeStore(selectDocument);
  const replaceDocument = useResumeStore((state) => state.replaceDocument);

  const [list, setList] = useState<ListState>({ status: "loading" });
  const [selection, setSelection] = useState<SelectionState>({ status: "idle" });
  const [restoring, setRestoring] = useState(false);

  /**
   * The snapshot the user last clicked. Every async result checks itself against this
   * before writing state, so clicking through the list quickly cannot leave the pane
   * showing an earlier row's document under a later row's highlight.
   */
  const wanted = useRef<string | null>(null);

  const loadVersions = useCallback(async (): Promise<void> => {
    if (!resumeId) {
      return;
    }

    setList({ status: "loading" });

    const result = await listResumeVersionsAction({ resumeId });

    setList(
      result.status === "ok"
        ? { status: "ready", versions: result.versions }
        : { status: "error", message: result.message },
    );
  }, [resumeId]);

  const selectVersion = useCallback(
    async (versionId: string): Promise<void> => {
      if (!resumeId) {
        return;
      }

      wanted.current = versionId;
      setSelection({ status: "loading", versionId });

      const result = await readResumeVersionAction({ resumeId, versionId });

      if (wanted.current !== versionId) {
        return;
      }

      setSelection(
        result.status === "ok"
          ? { status: "ready", versionId, version: result.version, document: result.document }
          : { status: "error", versionId, message: result.message },
      );
    },
    [resumeId],
  );

  // Reloaded on every open: a snapshot may have landed from an autosave since last time.
  useEffect(() => {
    if (!open) {
      return;
    }

    wanted.current = null;
    setSelection({ status: "idle" });
    void loadVersions();
  }, [open, loadVersions]);

  const diff = useMemo(
    () =>
      selection.status === "ready"
        ? diffResumeDocuments(selection.document, currentDocument)
        : null,
    [selection, currentDocument],
  );

  async function handleRestore(): Promise<void> {
    if (!resumeId || selection.status !== "ready") {
      return;
    }

    const { versionId } = selection;

    setRestoring(true);

    try {
      const result = await restoreResumeVersionAction({ resumeId, versionId });

      if (result.status === "ok") {
        replaceDocument(result.document);
        toast.success(`Restored version ${result.snapshotOf}.`, {
          description: "Undo puts it back. Your previous content is saved in the history.",
        });
        onOpenChange(false);

        return;
      }

      if (result.status === "unchanged") {
        toast.info("That version already matches what's open.");

        return;
      }

      toast.error(result.message);
    } catch (error) {
      console.error("[resume] restore threw", error);
      toast.error("Could not reach the server. Nothing was restored.");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        `p-0` so each pane owns its padding and the dividers reach the popup's edges —
        which means the footer's default `-mx-4 -mb-4`, sized for the popup's usual
        `p-4`, has to be cancelled or it hangs a whole rem outside the card.
      */}
      <DialogContent className="max-h-[90svh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border/60 p-4 pr-12 text-left">
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Snapshots are taken when you save. Restoring one keeps a copy of what&apos;s open now,
            and can be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-[16rem_1fr]">
          <div className="border-b border-border/60 sm:border-r sm:border-b-0">
            <VersionList
              state={list}
              selectedId={selection.status === "idle" ? null : selection.versionId}
              onRetry={loadVersions}
              onSelect={selectVersion}
            />
          </div>

          <SelectionPane selection={selection} diff={diff} onRetry={selectVersion} />
        </div>

        <DialogFooter className="mx-0 mb-0 border-t border-border/60">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            // Restoring a version identical to what is open would burn a snapshot and
            // change nothing, so the server refuses it — the button says so first.
            disabled={selection.status !== "ready" || restoring || diff?.entries.length === 0}
            onClick={handleRestore}
          >
            {restoring ? (
              <Spinner size="xs" label="Restoring" />
            ) : (
              <RotateCcw aria-hidden className="size-3.5" />
            )}
            Restore this version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VersionList({
  state,
  selectedId,
  onRetry,
  onSelect,
}: {
  state: ListState;
  selectedId: string | null;
  onRetry: () => void;
  onSelect: (versionId: string) => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 p-6 text-muted-foreground">
        <Spinner size="sm" />
        <span className="text-xs" role="status">
          Loading versions…
        </span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-4">
        <PaneError message={state.message} onRetry={onRetry} />
      </div>
    );
  }

  if (state.versions.length === 0) {
    return (
      <EmptyState
        size="compact"
        icon={History}
        title="No versions yet"
        description="Press ⌘S — or keep editing and let autosave run — and the first snapshot appears here."
      />
    );
  }

  return (
    <ScrollArea className="h-full max-h-96 sm:max-h-112">
      <ul className="divide-y divide-border/60">
        {state.versions.map((version) => {
          const selected = version.id === selectedId;

          return (
            <li key={version.id}>
              <button
                type="button"
                // `aria-current` rather than `aria-selected`: these are buttons in a
                // list, not options in a listbox, and `aria-selected` on a button is
                // ignored by screen readers.
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "flex w-full flex-col items-start gap-1 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none focus-visible:ring-inset",
                  selected && "bg-muted",
                )}
                onClick={() => onSelect(version.id)}
              >
                <span className="flex w-full items-center gap-2">
                  <span className="text-xs font-medium tabular-nums">v{version.version}</span>
                  <Badge variant="outline" className="shrink-0">
                    {VERSION_ORIGIN_LABELS[version.origin]}
                  </Badge>
                </span>

                {version.label.length > 0 ? (
                  <span className="line-clamp-2 text-xs text-foreground">{version.label}</span>
                ) : null}

                <time
                  dateTime={version.createdAt}
                  title={formatDateTime(version.createdAt) ?? undefined}
                  className="text-xs text-muted-foreground"
                >
                  {formatRelativeTime(version.createdAt)}
                </time>
              </button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}

function SelectionPane({
  selection,
  diff,
  onRetry,
}: {
  selection: SelectionState;
  diff: ReturnType<typeof diffResumeDocuments> | null;
  onRetry: (versionId: string) => void;
}) {
  if (selection.status === "idle") {
    return (
      <EmptyState
        size="compact"
        icon={History}
        title="Pick a version"
        description="You'll see exactly which fields differ from what's open before anything changes."
      />
    );
  }

  if (selection.status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 p-6 text-muted-foreground">
        <Spinner size="sm" />
        <span className="text-xs" role="status">
          Comparing…
        </span>
      </div>
    );
  }

  if (selection.status === "error") {
    return (
      <div className="p-4">
        <PaneError message={selection.message} onRetry={() => onRetry(selection.versionId)} />
      </div>
    );
  }

  if (!diff) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <span className="text-xs font-medium">
          v{selection.version.version} compared with the editor
        </span>
        {diff.entries.length === 0 ? (
          <Badge variant="secondary">Identical</Badge>
        ) : (
          <>
            {diff.added > 0 ? <Badge variant="outline">{diff.added} added since</Badge> : null}
            {diff.removed > 0 ? (
              <Badge variant="outline">{diff.removed} removed since</Badge>
            ) : null}
            {diff.changed > 0 ? (
              <Badge variant="outline">{diff.changed} changed since</Badge>
            ) : null}
          </>
        )}
      </div>

      {diff.entries.length === 0 ? (
        <EmptyState
          size="compact"
          title="Nothing would change"
          description="This snapshot matches the document open in the editor."
        />
      ) : (
        <ScrollArea className="h-full max-h-96 sm:max-h-112">
          <DiffList entries={diff.entries} />
        </ScrollArea>
      )}
    </div>
  );
}

function DiffList({ entries }: { entries: DiffEntry[] }) {
  // Grouped in place rather than sorted: `diffResumeDocuments` already returns
  // document order, so walking it keeps "Basics" above "Experience" without a
  // second ordering rule that could disagree with the editor's.
  const groups = useMemo(() => {
    const byGroup = new Map<string, DiffEntry[]>();

    for (const entry of entries) {
      const existing = byGroup.get(entry.group);

      if (existing) {
        existing.push(entry);
      } else {
        byGroup.set(entry.group, [entry]);
      }
    }

    return [...byGroup];
  }, [entries]);

  return (
    <div className="divide-y divide-border/60">
      {groups.map(([group, groupEntries]) => (
        <section key={group} className="px-4 py-3">
          <h3 className="text-xs font-semibold text-muted-foreground">{group}</h3>

          <dl className="mt-2 space-y-2.5">
            {groupEntries.map((entry) => (
              <div key={entry.key} className="space-y-1">
                <dt className="flex items-center gap-2 text-xs font-medium">
                  {entry.label}
                  <span className="sr-only">{DIFF_KIND_LABELS[entry.kind]}</span>
                </dt>

                <dd className="grid gap-1 text-xs sm:grid-cols-2">
                  <ValueCell
                    heading="In this version"
                    value={entry.before}
                    tone={entry.kind === "added" ? "muted" : "removed"}
                  />
                  <ValueCell
                    heading="In the editor"
                    value={entry.after}
                    tone={entry.kind === "removed" ? "muted" : "added"}
                  />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

/**
 * One side of one field.
 *
 * Colour is never the only signal — each cell is labelled with which document it
 * comes from, so the pane is readable in monochrome and to a screen reader that
 * ignores the tint (WCAG 1.4.1).
 */
function ValueCell({
  heading,
  value,
  tone,
}: {
  heading: string;
  value: string;
  tone: "added" | "removed" | "muted";
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-2 py-1.5",
        tone === "added" && "border-primary/30 bg-primary/5",
        tone === "removed" && "border-destructive/30 bg-destructive/5",
        tone === "muted" && "border-border/60 bg-muted/40",
      )}
    >
      <span className="block text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
        {heading}
      </span>
      <span className="mt-0.5 block wrap-break-word whitespace-pre-wrap">
        {value.length > 0 ? value : <span className="text-muted-foreground italic">Empty</span>}
      </span>
    </div>
  );
}

function PaneError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs"
    >
      <span className="flex items-center gap-2 font-medium text-destructive">
        <AlertCircle aria-hidden className="size-3.5" />
        {message}
      </span>

      {onRetry ? (
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
