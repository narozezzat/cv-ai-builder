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

import { ArrowLeft, History, Palette, Redo2, Save, Target, Undo2 } from "lucide-react";
import { useCallback, useState } from "react";

import { ButtonLink, IconButton } from "@/components/shared";
import { useRegisterCommands } from "@/components/providers/command-palette-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobMatchDialog } from "@/features/jobmatch";
import { useShortcutLabel, useShortcuts } from "@/hooks/use-shortcuts";
import { routes } from "@/lib/routes";

import { useSaveResume } from "../../hooks/use-save-resume";
import { RESUME_TITLE_MAX } from "../../schema/resume-schema";
import {
  selectCanRedo,
  selectCanUndo,
  selectDocument,
  selectIsDirty,
  useResumeStore,
} from "../../store/resume-store";
import { DesignDialog } from "./design-dialog";
import { SaveStatusIndicator } from "./save-status";
import { VersionHistoryDialog } from "./version-history-dialog";

const UNDO_COMBO = "mod+z";
const REDO_COMBO = "shift+mod+z";

export function EditorHeader() {
  const title = useResumeStore((state) => state.draft.title);
  const setTitle = useResumeStore((state) => state.setTitle);
  const undo = useResumeStore((state) => state.undo);
  const redo = useResumeStore((state) => state.redo);
  const canUndo = useResumeStore(selectCanUndo);
  const canRedo = useResumeStore(selectCanRedo);
  const isDirty = useResumeStore(selectIsDirty);
  const status = useResumeStore((state) => state.status);
  const resumeId = useResumeStore((state) => state.resumeId);

  const { save } = useSaveResume();
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);

  /*
    Read on demand, not subscribed. Subscribing here would re-render the whole header —
    title input included — on every keystroke anywhere in the editor, to serve a dialog
    that reads the document twice per sitting.
  */
  const getDocument = useCallback(() => selectDocument(useResumeStore.getState()), []);

  const undoLabel = useShortcutLabel(UNDO_COMBO);
  const redoLabel = useShortcutLabel(REDO_COMBO);

  const canSave = isDirty && !saving && status !== "conflict";

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

  /*
    Undo and redo are bound here rather than in the store or the shortcut layer,
    because "the editor is on screen" is the condition — the bindings must disappear
    with this header, or `⌘Z` on the dashboard would step through resume history.

    `allowInInput: false` is the whole point of the pair: while the caret is in a text
    field or a rich-text editor, `⌘Z` belongs to that field's own undo stack. Document
    history steps only once focus is elsewhere, which is also where the user's mental
    model puts it.
  */
  useShortcuts([
    { combo: REDO_COMBO, handler: redo, allowInInput: false },
    { combo: UNDO_COMBO, handler: undo, allowInInput: false },
  ]);

  useRegisterCommands([
    {
      id: "resume.save",
      label: "Save resume",
      group: "context",
      keywords: ["write", "persist"],
      shortcut: "mod+s",
      icon: <Save aria-hidden />,
      disabled: !canSave,
      perform: handleSave,
    },
    {
      id: "resume.undo",
      label: "Undo",
      group: "context",
      shortcut: UNDO_COMBO,
      icon: <Undo2 aria-hidden />,
      disabled: !canUndo,
      // Undo is the one command people run several times in a row, so the palette
      // stays open and the list's `disabled` state updates as the stack drains.
      keepOpen: true,
      perform: undo,
    },
    {
      id: "resume.redo",
      label: "Redo",
      group: "context",
      shortcut: REDO_COMBO,
      icon: <Redo2 aria-hidden />,
      disabled: !canRedo,
      keepOpen: true,
      perform: redo,
    },
    {
      id: "resume.design",
      label: "Change design",
      group: "context",
      keywords: ["template", "theme", "colour", "color", "font", "typography", "margin", "page"],
      icon: <Palette aria-hidden />,
      perform: () => setDesignOpen(true),
    },
    {
      id: "resume.history",
      label: "Version history",
      group: "context",
      keywords: ["versions", "restore", "revert"],
      icon: <History aria-hidden />,
      perform: () => setHistoryOpen(true),
    },
    {
      id: "resume.jobmatch",
      label: "Match to a job",
      group: "context",
      keywords: ["job description", "jd", "ats", "score", "keywords"],
      icon: <Target aria-hidden />,
      perform: () => setMatchOpen(true),
    },
  ]);

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
            // Resolved at runtime: hardcoding `⌘Z` tells a Windows user the wrong key.
            shortcut={undoLabel ?? undefined}
            icon={<Undo2 aria-hidden className="size-4" />}
            size="icon-sm"
            disabled={!canUndo}
            onClick={undo}
          />
          <IconButton
            label="Redo"
            shortcut={redoLabel ?? undefined}
            icon={<Redo2 aria-hidden className="size-4" />}
            size="icon-sm"
            disabled={!canRedo}
            onClick={redo}
          />
          <IconButton
            label="Change design"
            icon={<Palette aria-hidden className="size-4" />}
            size="icon-sm"
            onClick={() => setDesignOpen(true)}
          />
          <IconButton
            label="Match to a job"
            icon={<Target aria-hidden className="size-4" />}
            size="icon-sm"
            onClick={() => setMatchOpen(true)}
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
          disabled={!canSave}
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
      <DesignDialog open={designOpen} onOpenChange={setDesignOpen} />

      <VersionHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />

      <JobMatchDialog
        open={matchOpen}
        onOpenChange={setMatchOpen}
        resumeId={resumeId}
        getDocument={getDocument}
      />
    </header>
  );
}
