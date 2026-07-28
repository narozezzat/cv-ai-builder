"use client";

/**
 * The editor shell.
 *
 * Takes the resume the server read and installs it in the store, then renders the
 * chrome around the section list. The props are plain data — no functions cross the
 * boundary, because a function passed from a Server Component to a client one cannot
 * be serialised and takes the whole route down with it.
 *
 * `initialize` deliberately refuses to clobber unsaved work (see its comment in the
 * store), which is what makes this safe to call from an effect that React runs twice
 * in development and again on every RSC re-render.
 */

import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResumeDocument, ResumePage, ResumeTheme } from "@/types/resume";

import { useAutosaveResume } from "../../hooks/use-autosave-resume";
import { useResumeStore } from "../../store/resume-store";
import { BasicsPanel } from "./basics-panel";
import { EditorHeader } from "./editor-header";
import { ResumePreview } from "./resume-preview";
import { SectionList } from "./section-list";

/** Which pane the small-screen toggle is showing. Both are mounted at `lg` and up. */
type EditorPane = "edit" | "preview";

export interface ResumeEditorProps {
  resumeId: string;
  title: string;
  document: ResumeDocument;
  theme: ResumeTheme;
  page: ResumePage;
  templateId: string;
  /** `resumes.updated_at`, the optimistic-concurrency token. */
  savedAt: string;
}

export function ResumeEditor({
  resumeId,
  title,
  // Renamed on the way in: `document` as a local would shadow the global one, and
  // the next person to reach for `document.activeElement` here would get a resume.
  document: resumeDocument,
  theme,
  page,
  templateId,
  savedAt,
}: ResumeEditorProps) {
  const initialize = useResumeStore((state) => state.initialize);
  const reset = useResumeStore((state) => state.reset);
  const status = useResumeStore((state) => state.status);
  const error = useResumeStore((state) => state.error);
  const openResumeId = useResumeStore((state) => state.resumeId);
  const [pane, setPane] = useState<EditorPane>("edit");

  /*
    Declared before the `initialize` effect on purpose. React runs cleanups in the
    order the effects were declared, so autosave's flush-on-unmount fires while the
    store still holds this resume — after `reset()` there is nothing left to write.
  */
  useAutosaveResume();

  useEffect(() => {
    initialize({ resumeId, title, document: resumeDocument, theme, page, templateId, savedAt });

    // Cleared on unmount so the next resume opened does not briefly render the
    // previous one's content while its own effect runs.
    return () => reset();
  }, [initialize, reset, resumeId, title, resumeDocument, theme, page, templateId, savedAt]);

  return (
    <div className="flex min-h-svh flex-col">
      <EditorHeader />

      {/*
        Below `lg` the two panes share the screen, so one of them is a tab. Above it
        both are mounted side by side and the toggle disappears — a preview you have
        to ask for is a preview you stop trusting.
      */}
      <div className="mx-auto flex w-full max-w-7xl gap-2 px-3 pt-4 sm:px-6 lg:hidden">
        {(["edit", "preview"] as const).map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={pane === value ? "secondary" : "ghost"}
            aria-pressed={pane === value}
            className="flex-1"
            onClick={() => setPane(value)}
          >
            {value === "edit" ? "Edit" : "Preview"}
          </Button>
        ))}
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-3 py-6 sm:px-6 lg:gap-8">
        <main
          id="main"
          className={cn(
            "w-full min-w-0 flex-1 space-y-6 lg:max-w-3xl",
            pane === "preview" && "hidden lg:block",
          )}
        >
          {status === "conflict" || status === "error" ? (
            <Alert variant="destructive">
              <AlertTitle>
                {status === "conflict"
                  ? "This resume changed elsewhere"
                  : "Your changes are not saved"}
              </AlertTitle>
              <AlertDescription className="space-y-2">
                <p>{error}</p>
                {status === "conflict" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    // A full reload rather than `router.refresh()`: refreshing would
                    // re-render the server component, but `initialize` ignores server
                    // state while the draft is dirty — by design — so the newer
                    // version would never appear.
                    onClick={() => window.location.reload()}
                  >
                    Reload this resume
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          {/*
          Rendered only once the store holds this resume. For one frame after mount
          the store is still blank, and the fields would read empty strings from it —
          which is indistinguishable from a resume whose content failed to load.
        */}
          {openResumeId === resumeId ? (
            <>
              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Basics</h2>
                <BasicsPanel />
              </section>

              <SectionList />
            </>
          ) : null}
        </main>

        {/*
          `sticky` with its own scroll: the resume is short, the form is long, and a
          preview that scrolls out of view while you edit section nine is decoration.
          Only mounted once the store holds this resume — an unpopulated preview is a
          blank sheet of paper, which reads as data loss.
        */}
        <aside
          className={cn(
            "w-full min-w-0 lg:sticky lg:top-14 lg:block lg:h-[calc(100svh-3.5rem)] lg:w-104 lg:shrink-0 lg:overflow-y-auto lg:py-2 xl:w-lg",
            pane === "edit" && "hidden lg:block",
          )}
        >
          {openResumeId === resumeId ? (
            <ResumePreview />
          ) : (
            <div
              aria-hidden
              className="aspect-[1/1.414] w-full animate-pulse rounded-sm bg-muted"
            />
          )}
        </aside>
      </div>
    </div>
  );
}
