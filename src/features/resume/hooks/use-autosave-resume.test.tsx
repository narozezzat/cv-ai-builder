/**
 * Autosave, with the clock under test control.
 *
 * `useSaveResume` is mocked rather than the server action, because what this hook owns is
 * *when* a save happens — the debounce window, the statuses that must not schedule one,
 * and the three ways out of the editor that have to flush. Whether the write succeeds is
 * `use-save-resume`'s problem.
 */

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RESUME_PAGE_DEFAULTS,
  RESUME_THEME_DEFAULTS,
  DEFAULT_TEMPLATE_ID,
  emptyResumeDocument,
} from "@/types/resume";

import { useResumeStore } from "../store/resume-store";
import { AUTOSAVE_DELAY_MS, useAutosaveResume } from "./use-autosave-resume";

const save = vi.fn<() => Promise<boolean>>();

vi.mock("./use-save-resume", () => ({
  useSaveResume: () => ({ save }),
}));

const RESUME_ID = "11111111-1111-4111-8111-111111111111";
const SAVED_AT = "2026-01-01T00:00:00.000Z";

function Harness() {
  useAutosaveResume();

  return null;
}

/**
 * The real `save` also moves the store's status; the mock has to, because the scheduler
 * reads that status — a mock that only returned a boolean would test a different hook.
 */
function resolveSaveWith(ok: boolean) {
  save.mockImplementation(async () => {
    const state = useResumeStore.getState();

    if (ok) {
      state.markSaved({ draft: state.draft, savedAt: SAVED_AT });
    } else {
      state.markError("Could not reach the server. Your changes are still here.");
    }

    return ok;
  });
}

function edit(text: string) {
  act(() => {
    useResumeStore.getState().setBasics({ fullName: text });
  });
}

async function advance(ms: number) {
  // Async: the timer callback awaits `save`, so the microtask queue has to drain too.
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  save.mockReset();
  resolveSaveWith(true);

  useResumeStore.getState().reset();
  useResumeStore.getState().initialize({
    resumeId: RESUME_ID,
    title: "Untitled",
    document: emptyResumeDocument(),
    theme: RESUME_THEME_DEFAULTS,
    page: RESUME_PAGE_DEFAULTS,
    templateId: DEFAULT_TEMPLATE_ID,
    savedAt: SAVED_AT,
  });
});

afterEach(() => {
  vi.useRealTimers();
  useResumeStore.getState().reset();
});

describe("useAutosaveResume", () => {
  it("does not save an untouched resume", async () => {
    render(<Harness />);
    await advance(AUTOSAVE_DELAY_MS * 4);

    expect(save).not.toHaveBeenCalled();
  });

  it("saves once the debounce window elapses", async () => {
    render(<Harness />);
    edit("Ada");

    await advance(AUTOSAVE_DELAY_MS - 1);
    expect(save).not.toHaveBeenCalled();

    await advance(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("collapses a burst of edits into one save", async () => {
    render(<Harness />);

    for (const name of ["A", "Ad", "Ada", "Ada L"]) {
      edit(name);
      await advance(AUTOSAVE_DELAY_MS - 200);
    }

    expect(save).not.toHaveBeenCalled();

    await advance(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("does not retry on its own after a failed save", async () => {
    resolveSaveWith(false);
    render(<Harness />);
    edit("Ada");

    await advance(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);
    expect(useResumeStore.getState().status).toBe("error");

    // The draft is still dirty, so a scheduler keyed on dirtiness alone would loop here.
    await advance(AUTOSAVE_DELAY_MS * 20);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("backs off before the next edit's save", async () => {
    resolveSaveWith(false);
    render(<Harness />);
    edit("Ada");
    await advance(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);

    edit("Ada L");
    await advance(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);

    await advance(AUTOSAVE_DELAY_MS);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("never writes while a conflict is unresolved", async () => {
    render(<Harness />);
    edit("Ada");

    act(() => {
      useResumeStore.getState().markConflict("Someone else saved this resume.");
    });

    await advance(AUTOSAVE_DELAY_MS * 10);
    expect(save).not.toHaveBeenCalled();
  });

  it("flushes on Cmd/Ctrl+S without waiting for the debounce", async () => {
    render(<Harness />);
    edit("Ada");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true }));
    });

    expect(save).toHaveBeenCalledTimes(1);

    // The pending timer was cancelled, not left to fire a second write.
    await advance(AUTOSAVE_DELAY_MS * 2);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("flushes when the tab is hidden", async () => {
    render(<Harness />);
    edit("Ada");

    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(save).toHaveBeenCalledTimes(1);
    visibility.mockRestore();
  });

  it("flushes on unmount, mid-window", async () => {
    const view = render(<Harness />);
    edit("Ada");

    await act(async () => {
      view.unmount();
    });

    expect(save).toHaveBeenCalledTimes(1);
  });

  it("does not flush on unmount when nothing is dirty", async () => {
    const view = render(<Harness />);

    await act(async () => {
      view.unmount();
    });

    expect(save).not.toHaveBeenCalled();
  });
});
