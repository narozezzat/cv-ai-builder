import { describe, expect, it } from "vitest";

import { HISTORY_LIMITS, canRedo, canUndo, commit, createHistory, redo, undo } from "./history";

/**
 * The store passes distinct object references for distinct states, because Immer
 * gives it that for free. These tests do the same with plain objects.
 */
interface Doc {
  text: string;
}

const doc = (text: string): Doc => ({ text });

describe("commit", () => {
  it("starts empty", () => {
    const history = createHistory<Doc>();

    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it("pushes the previous value so undo restores it", () => {
    const a = doc("a");
    const b = doc("b");

    const history = commit(createHistory<Doc>(), a, b, { now: 0 });

    expect(canUndo(history)).toBe(true);
    expect(undo(history, b)?.value).toBe(a);
  });

  it("ignores a commit where nothing changed", () => {
    const a = doc("a");

    const history = commit(createHistory<Doc>(), a, a, { now: 0 });

    expect(canUndo(history)).toBe(false);
  });

  it("keeps discrete edits as separate steps", () => {
    let history = createHistory<Doc>();
    history = commit(history, doc("a"), doc("b"), { now: 0 });
    history = commit(history, doc("b"), doc("c"), { now: 1 });

    expect(history.past).toHaveLength(2);
  });

  it("folds consecutive edits carrying the same key", () => {
    const start = doc("");
    let history = createHistory<Doc>();
    history = commit(history, start, doc("h"), { coalesceKey: "headline", now: 0 });
    history = commit(history, doc("h"), doc("he"), { coalesceKey: "headline", now: 100 });
    history = commit(history, doc("he"), doc("hea"), { coalesceKey: "headline", now: 200 });

    expect(history.past).toHaveLength(1);
    // One undo returns to before the run began, not to the previous keystroke.
    expect(undo(history, doc("hea"))?.value).toBe(start);
  });

  it("breaks the run when the key changes, even inside the window", () => {
    let history = createHistory<Doc>();
    history = commit(history, doc("a"), doc("b"), { coalesceKey: "headline", now: 0 });
    history = commit(history, doc("b"), doc("c"), { coalesceKey: "location", now: 10 });

    expect(history.past).toHaveLength(2);
  });

  it("breaks the run after an idle gap", () => {
    let history = createHistory<Doc>();
    history = commit(history, doc("a"), doc("b"), { coalesceKey: "headline", now: 0 });
    history = commit(history, doc("b"), doc("c"), {
      coalesceKey: "headline",
      now: HISTORY_LIMITS.coalesceWindowMs + 1,
    });

    expect(history.past).toHaveLength(2);
  });

  it("breaks a run that has grown for longer than the run ceiling", () => {
    let history = createHistory<Doc>();
    let now = 0;
    let text = "";

    // Continuous typing, never pausing long enough to trip the idle gap. The bound
    // runs one window past the ceiling, since the commit that breaks the run is the
    // first one to land after it.
    while (now <= HISTORY_LIMITS.coalesceRunMs + HISTORY_LIMITS.coalesceWindowMs) {
      const previous = doc(text);
      text += "x";
      history = commit(history, previous, doc(text), { coalesceKey: "summary", now });
      now += HISTORY_LIMITS.coalesceWindowMs - 1;
    }

    expect(history.past.length).toBeGreaterThan(1);
  });

  it("never coalesces without a key", () => {
    let history = createHistory<Doc>();
    history = commit(history, doc("a"), doc("b"), { now: 0 });
    history = commit(history, doc("b"), doc("c"), { now: 1 });

    expect(history.past).toHaveLength(2);
  });

  it("drops the oldest entry past the depth limit", () => {
    let history = createHistory<Doc>();

    for (let index = 0; index <= HISTORY_LIMITS.depth; index += 1) {
      history = commit(history, doc(`v${index}`), doc(`v${index + 1}`), { now: index });
    }

    expect(history.past).toHaveLength(HISTORY_LIMITS.depth);
    // v0 fell off the bottom; the oldest reachable state is v1.
    expect(history.past[0]?.value.text).toBe("v1");
  });

  it("clears the redo stack", () => {
    const first = commit(createHistory<Doc>(), doc("a"), doc("b"), { now: 0 });
    const stepped = undo(first, doc("b"));

    expect(stepped).not.toBeNull();
    expect(canRedo(stepped!.history)).toBe(true);

    const branched = commit(stepped!.history, doc("a"), doc("z"), { now: 1 });

    expect(canRedo(branched)).toBe(false);
  });
});

describe("undo and redo", () => {
  it("returns null when there is nothing to step to", () => {
    const history = createHistory<Doc>();

    expect(undo(history, doc("a"))).toBeNull();
    expect(redo(history, doc("a"), 0)).toBeNull();
  });

  it("round-trips a single edit", () => {
    const a = doc("a");
    const b = doc("b");

    const committed = commit(createHistory<Doc>(), a, b, { now: 0 });
    const undone = undo(committed, b);
    const redone = redo(undone!.history, undone!.value, 1);

    expect(undone!.value).toBe(a);
    expect(redone!.value).toBe(b);
    expect(canRedo(redone!.history)).toBe(false);
    expect(canUndo(redone!.history)).toBe(true);
  });

  it("walks back through a multi-step history in order", () => {
    const values = [doc("a"), doc("b"), doc("c"), doc("d")];
    let history = createHistory<Doc>();

    for (let index = 1; index < values.length; index += 1) {
      history = commit(history, values[index - 1], values[index], { now: index });
    }

    let current = values[values.length - 1];
    const walked: string[] = [];

    for (let step = undo(history, current); step; step = undo(history, current)) {
      history = step.history;
      current = step.value;
      walked.push(current.text);
    }

    expect(walked).toEqual(["c", "b", "a"]);
    expect(canUndo(history)).toBe(false);
  });

  it("does not let a redone edit merge with what the user types next", () => {
    const committed = commit(createHistory<Doc>(), doc("a"), doc("b"), {
      coalesceKey: "headline",
      now: 0,
    });
    const undone = undo(committed, doc("b"));
    const redone = redo(undone!.history, undone!.value, 1);

    // Same key, well inside the window — and still a new entry, because the
    // re-pushed past entry is deliberately unkeyed.
    const typed = commit(redone!.history, doc("b"), doc("bc"), {
      coalesceKey: "headline",
      now: 2,
    });

    expect(typed.past).toHaveLength(2);
    expect(undo(typed, doc("bc"))?.value.text).toBe("b");
  });

  it("bounds the redo stack", () => {
    let history = createHistory<Doc>();

    for (let index = 0; index <= HISTORY_LIMITS.depth; index += 1) {
      history = commit(history, doc(`v${index}`), doc(`v${index + 1}`), { now: index });
    }

    let current = doc(`v${HISTORY_LIMITS.depth + 1}`);

    for (let step = undo(history, current); step; step = undo(history, current)) {
      history = step.history;
      current = step.value;
      expect(history.future.length).toBeLessThanOrEqual(HISTORY_LIMITS.depth);
    }
  });
});
