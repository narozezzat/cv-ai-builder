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
 */

import { useCallback, useRef } from "react";

import { saveResumeAction } from "../actions/resume-actions";
import { useResumeStore } from "../store/resume-store";

export interface UseSaveResumeResult {
  /** Resolves `true` when the row was written. Safe to call when nothing is dirty. */
  save: () => Promise<boolean>;
}

export function useSaveResume(): UseSaveResumeResult {
  /**
   * Guards against two saves overlapping. Two in flight at once means the second
   * carries the same `expectedUpdatedAt` as the first, so it is guaranteed to report
   * a conflict that does not exist.
   */
  const inFlight = useRef(false);

  const save = useCallback(async (): Promise<boolean> => {
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

      if (result.status === "saved") {
        useResumeStore.getState().markSaved({ draft, savedAt: result.savedAt });

        return true;
      }

      if (result.status === "conflict") {
        useResumeStore
          .getState()
          .markConflict(
            "This resume changed somewhere else since you opened it. Reload to get the newer version — your unsaved edits here would be overwritten.",
          );

        return false;
      }

      useResumeStore.getState().markError(result.message);

      return false;
    } catch (error) {
      // A rejected action is a network or runtime failure, not a validation one.
      // Reported as retryable because it is: the draft is still in the store.
      console.error("[resume] save threw", error);
      useResumeStore
        .getState()
        .markError("Could not reach the server. Your changes are still here.");

      return false;
    } finally {
      inFlight.current = false;
    }
  }, []);

  return { save };
}
