"use client";

/**
 * Autosave.
 *
 * The rules, each of which exists because the naive version loses work:
 *
 * - **Only a `dirty` status schedules a save.** Not `error` — a failed save leaves the
 *   draft unchanged, so retrying on `error` is an infinite 1.5s loop against a server
 *   that is already unhappy. The next keystroke turns the status back to `dirty` and the
 *   retry rides along with it. Not `conflict` either: that one is terminal until the user
 *   answers the prompt, and writing again would overwrite the version we never read.
 *
 * - **The timer is keyed on the draft's identity.** Immer gives a new draft reference per
 *   edit, so every edit clears the pending timer and starts a new one — which is what
 *   "debounced" has to mean when the trigger is typing.
 *
 * - **Backoff after failures**, `delay × 2^min(failures, 3)`, reset on success. A user
 *   typing through an outage otherwise fires a request per 1.5s for as long as they type.
 *
 * - **Flush on the ways out**: unmount (route change), `Cmd/Ctrl+S`, and the tab going
 *   hidden — iOS discards backgrounded tabs without ever firing `beforeunload`, so
 *   `visibilitychange` is the only reliable last chance to write.
 *
 * - **`beforeunload` only warns.** A save cannot be awaited there; the prompt is the
 *   honest option when a debounce window is still open.
 */

import { useCallback, useEffect, useRef } from "react";

import { selectDraft, selectIsDirty, useResumeStore } from "../store/resume-store";
import { useSaveResume } from "./use-save-resume";

export const AUTOSAVE_DELAY_MS = 1500;

/** Four steps of doubling — 1.5s to 12s — then flat. Beyond that the user has noticed. */
const MAX_BACKOFF_STEPS = 3;

export interface UseAutosaveResumeResult {
  /** Saves now, cancelling any pending debounce. Wired to `Cmd/Ctrl+S`. */
  flush: () => Promise<boolean>;
}

export function useAutosaveResume(): UseAutosaveResumeResult {
  const { save } = useSaveResume();
  const status = useResumeStore((state) => state.status);
  const draft = useResumeStore(selectDraft);
  const isDirty = useResumeStore(selectIsDirty);

  const failures = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async (): Promise<boolean> => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    const saved = await save();

    failures.current = saved ? 0 : failures.current + 1;

    return saved;
  }, [save]);

  /**
   * Kept in a ref so the unmount and listener effects can call the current `run` without
   * re-subscribing on every edit — re-running an unmount effect per keystroke would fire
   * a save on each one.
   */
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!isDirty || status !== "dirty") {
      return;
    }

    const delay = AUTOSAVE_DELAY_MS * 2 ** Math.min(failures.current, MAX_BACKOFF_STEPS);

    timer.current = setTimeout(() => {
      timer.current = null;
      void runRef.current();
    }, delay);

    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
    // `draft` is a dependency for its identity alone: a new reference means a new edit,
    // which must restart the debounce window.
  }, [draft, isDirty, status]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "s" || !(event.metaKey || event.ctrlKey)) {
        return;
      }

      // Otherwise the browser opens its "save page as" dialog over the editor.
      event.preventDefault();
      void runRef.current();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden" && isDirtyNow()) {
        void runRef.current();
      }
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (isDirtyNow()) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  useEffect(
    () => () => {
      // Navigating away mid-window. The request outlives this component — it is already
      // dispatched — and `useSaveResume` drops the response if another resume is open by
      // the time it lands.
      if (isDirtyNow()) {
        void runRef.current();
      }
    },
    [],
  );

  return { flush: run };
}

/** Read from the store rather than from a render's closure: listeners outlive renders. */
function isDirtyNow(): boolean {
  const state = useResumeStore.getState();

  return state.resumeId !== null && state.status !== "conflict" && selectIsDirty(state);
}
