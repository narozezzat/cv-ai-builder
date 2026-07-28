"use client";

/**
 * Manual save.
 *
 * The debounce, the flush-on-navigate, and the conflict prompt land with autosave;
 * this is the primitive all of them will call, and it exists now because an editor
 * that cannot write is not shippable even for one commit.
 *
 * Two details matter and are easy to get wrong:
 *
 * 1. **The snapshot is taken before the request, and `markSaved` is given that same
 *    snapshot** — not the store's current draft. If the user types while the request
 *    is open, the store stays dirty and the next save carries the newer text. Passing
 *    "whatever is current now" would mark those keystrokes as saved when they were
 *    not, and they would be lost on reload.
 *
 * 2. **`expectedUpdatedAt` is the token from the last read or write.** The server
 *    matches on it, so a row someone else changed in another tab updates zero rows
 *    and comes back as `conflict` instead of overwriting work we never saw.
 *
 * 3. **Nothing is written back to the store unless the same resume is still open.**
 *    Autosave flushes on unmount, so a response can land after `reset()` or after the
 *    user has opened a different resume — and `markSaved` would then install one
 *    resume's snapshot and `updated_at` on another, which is a silent data-loss bug
 *    the next save turns into a phantom conflict.
 *
 * 4. **The version snapshot is requested after the write, and never awaited.** History
 *    is a safety net, not part of the save: a snapshot that fails must not turn a
 *    successful save into an error, and waiting on a second round-trip would double
 *    the time the editor spends in `saving`. Whether the snapshot is actually stored is
 *    the server's call — `createResumeVersionAction` drops one that duplicates the
 *    newest, and throttles the autosave ones.
 */

import { useCallback, useRef } from "react";

import { createResumeVersionAction, saveResumeAction } from "../actions/resume-actions";
import type { SnapshotOrigin } from "../schema/resume-schema";
import { useResumeStore } from "../store/resume-store";

/**
 * The store, but only while `resumeId` is still the one this save was for. `undefined`
 * means the response outlived the editor that asked for it and must be dropped.
 */
function current(resumeId: string) {
  const state = useResumeStore.getState();

  return state.resumeId === resumeId ? state : undefined;
}

/**
 * Asks for a snapshot of the row as it now stands, and swallows every failure.
 *
 * Not awaited by the caller: history is a safety net around the save, not a step
 * inside it. `void` on the promise plus a `catch` is what keeps a rejected action
 * from surfacing as an unhandled rejection in the console.
 */
function requestSnapshot(resumeId: string, origin: SnapshotOrigin): void {
  void createResumeVersionAction({ resumeId, origin }).catch((error: unknown) => {
    console.error("[resume] snapshot threw", error);
  });
}

export interface UseSaveResumeResult {
  /**
   * Resolves `true` when the row was written. Safe to call when nothing is dirty.
   *
   * `origin` labels the version snapshot the save leaves behind — `"manual"` for the
   * Save button and `Cmd/Ctrl+S`, `"autosave"` for the debounce. It is not cosmetic:
   * the server only enforces a minimum gap between `"autosave"` snapshots, so a
   * deliberate save is never throttled and a keystroke storm never fills the history.
   */
  save: (origin?: SnapshotOrigin) => Promise<boolean>;
}

export function useSaveResume(): UseSaveResumeResult {
  /**
   * Guards against two saves overlapping. Two in flight at once means the second
   * carries the same `expectedUpdatedAt` as the first, so it is guaranteed to report
   * a conflict that does not exist.
   */
  const inFlight = useRef(false);

  const save = useCallback(async (origin: SnapshotOrigin = "autosave"): Promise<boolean> => {
    const state = useResumeStore.getState();
    const { resumeId, savedAt, draft } = state;

    if (!resumeId || !savedAt || inFlight.current) {
      return false;
    }

    if (Object.is(draft, state.saved)) {
      // Nothing changed. Writing anyway would burn a rate-limit slot and advance
      // `updated_at`, which is the token every other tab is holding.
      return true;
    }

    inFlight.current = true;
    state.markSaving();

    try {
      const result = await saveResumeAction({
        resumeId,
        title: draft.title,
        templateId: draft.templateId,
        document: draft.document,
        theme: draft.theme,
        page: draft.page,
        expectedUpdatedAt: savedAt,
      });

      const store = current(resumeId);

      if (result.status === "saved") {
        // Still reported as written even if the editor moved on: the row *was* saved.
        store?.markSaved({ draft, savedAt: result.savedAt });
        // Snapshots the row that was just written, so it is requested even when the
        // editor has since navigated away — the point of history is the version that
        // exists, not the tab that asked for it.
        requestSnapshot(resumeId, origin);

        return true;
      }

      if (result.status === "conflict") {
        store?.markConflict(
          "This resume changed somewhere else since you opened it. Reload to get the newer version — your unsaved edits here would be overwritten.",
        );

        return false;
      }

      store?.markError(result.message);

      return false;
    } catch (error) {
      // A rejected action is a network or runtime failure, not a validation one.
      // Reported as retryable because it is: the draft is still in the store.
      console.error("[resume] save threw", error);
      current(resumeId)?.markError("Could not reach the server. Your changes are still here.");

      return false;
    } finally {
      inFlight.current = false;
    }
  }, []);

  return { save };
}
