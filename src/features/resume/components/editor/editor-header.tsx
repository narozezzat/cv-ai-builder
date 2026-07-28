"use client";

/**
 * Editor chrome: where you came from, what this resume is called, and the state of
 * your work.
 *
 * Its own header rather than the dashboard's. The dashboard header carries the app
 * nav, and nav beside an editor invites a click that leaves unsaved work behind; the
 * one link out is deliberate and sits next to the save indicator so the two are read
 * together.
 */

import { ArrowLeft, History, Redo2, Save, Undo2 } from "lucide-react";
import { useState } from "react";

import { ButtonLink, IconButton } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { routes } from "@/lib/routes";

import { useSaveResume } from "../../hooks/use-save-resume";
import { RESUME_TITLE_MAX } from "../../schema/resume-schema";
import {
  selectCanRedo,
  selectCanUndo,
  selectIsDirty,
  useResumeStore,
} from "../../store/resume-store";
import { SaveStatusIndicator } from "./save-status";
import { VersionHistoryDialog } from "./version-history-dialog";

export function EditorHeader() {
  const title = useResumeStore((state) => state.draft.title);
  const setTitle = useResumeStore((state) => state.setTitle);
  const undo = useResumeStore((state) => state.undo);
  const redo = useResumeStore((state) => state.redo);
  const canUndo = useResumeStore(selectCanUndo);
  const canRedo = useResumeStore(selectCanRedo);
  const isDirty = useResumeStore(selectIsDirty);
  const status = useResumeStore((state) => state.status);

  const { save } = useSaveResume();
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  async function handleSave(): Promise<void> {
    setSaving(true);

    try {
      // `"manual"` so the snapshot this leaves behind is never throttled: pressing Save
      // is the user asking for a point they can come back to.
      await save("manual");
    } finally {
      setSaving(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-3 sm:px-6">
        <ButtonLink href={routes.resumes} variant="ghost" size="sm" className="shrink-0">
          <ArrowLeft aria-hidden className="size-4" />
          <span className="hidden sm:inline">Resumes</span>
        </ButtonLink>

        {/*
          Borderless until focused. The title is the page's heading, and a boxed
          input at the top of an editor reads as a form field to fill in rather than
          a name to change.
        */}
        <Input
          value={title}
          maxLength={RESUME_TITLE_MAX}
          aria-label="Resume title"
          placeholder="Untitled resume"
          className="h-8 min-w-0 flex-1 border-transparent bg-transparent text-sm font-medium shadow-none hover:border-border focus-visible:border-ring"
          onChange={(event) => setTitle(event.target.value)}
        />

        <SaveStatusIndicator className="shrink-0" />

        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            label="Undo"
            shortcut="⌘Z"
            icon={<Undo2 aria-hidden className="size-4" />}
            size="icon-sm"
            disabled={!canUndo}
            onClick={undo}
          />
          <IconButton
            label="Redo"
            shortcut="⇧⌘Z"
            icon={<Redo2 aria-hidden className="size-4" />}
            size="icon-sm"
            disabled={!canRedo}
            onClick={redo}
          />
          <IconButton
            label="Version history"
            icon={<History aria-hidden className="size-4" />}
            size="icon-sm"
            onClick={() => setHistoryOpen(true)}
          />
        </div>

        <Button
          type="button"
          size="sm"
          // `conflict` is excluded: writing again is exactly what must not happen
          // until the user decides whose version wins.
          disabled={!isDirty || saving || status === "conflict"}
          onClick={handleSave}
        >
          <Save aria-hidden className="size-3.5" />
          <span className="hidden sm:inline">Save</span>
        </Button>
      </div>

      {/*
        Mounted here rather than at the trigger so the popup is not a child of the
        button row — a dialog inside a flex row of controls inherits its gap and
        shrink rules the moment it renders anything inline.
      */}
      <VersionHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
    </header>
  );
}
