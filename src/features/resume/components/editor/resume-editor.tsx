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

import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ResumeDocument, ResumePage, ResumeTheme } from "@/types/resume";

import { useResumeStore } from "../../store/resume-store";
import { BasicsPanel } from "./basics-panel";
import { EditorHeader } from "./editor-header";
import { SectionList } from "./section-list";

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

  useEffect(() => {
    initialize({ resumeId, title, document: resumeDocument, theme, page, templateId, savedAt });

    // Cleared on unmount so the next resume opened does not briefly render the
    // previous one's content while its own effect runs.
    return () => reset();
  }, [initialize, reset, resumeId, title, resumeDocument, theme, page, templateId, savedAt]);

  return (
    <div className="flex min-h-svh flex-col">
      <EditorHeader />

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-3 py-6 sm:px-6">
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
    </div>
  );
}
