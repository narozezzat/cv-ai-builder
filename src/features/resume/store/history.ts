/**
 * Undo/redo, as a pure reducer over two stacks.
 *
 * No store, no React, no clock — every input arrives as an argument, which is why
 * this can be tested exhaustively without mounting anything. The Zustand store
 * owns the state; this owns the rules.
 *
 * **Snapshots, not patches.** Immer patches would be smaller per entry, but undoing
 * to an arbitrary point then means replaying inverse patches in the right order and
 * keeping that order correct through coalescing — three chances to corrupt a user's
 * document to save memory we are not short of. Immer's structural sharing already
 * makes a snapshot cost only the nodes that actually changed, so 50 entries of a
 * resume is a handful of objects, and undo is a pointer swap.
 *
 * **Coalescing.** One undo per keystroke is unusable. Consecutive commits carrying
 * the same `coalesceKey` fold into the entry already on the stack, so a typing run
 * in one field is one undo step. Two guards keep that from swallowing the whole
 * session: a gap longer than `coalesceWindowMs` starts a new entry, and so does a
 * run that has been going for `coalesceRunMs` — nobody wants a paragraph to vanish
 * in one keypress because they never paused.
 */

/** Tuning, in one place so the store and its tests cannot disagree. */
export const HISTORY_LIMITS = {
  /** Entries kept per stack. Deep enough to recover from a bad idea, bounded so a
   *  long session cannot grow without ceiling. */
  depth: 50,
  /** Idle gap that ends a coalescing run. */
  coalesceWindowMs: 500,
  /** Longest a single run may absorb, however continuous the typing. */
  coalesceRunMs: 4_000,
} as const;

interface HistoryEntry<TValue> {
  /** The value to restore — i.e. the state *before* the commit that created it. */
  value: TValue;
  /** Which edit produced this entry, or `null` for one that never coalesces. */
  key: string | null;
  /** When the run began. Bounds how much one entry can absorb. */
  startedAt: number;
  /** When the run last grew. Compared against the idle gap. */
  updatedAt: number;
}

export interface History<TValue> {
  past: HistoryEntry<TValue>[];
  future: TValue[];
}

export function createHistory<TValue>(): History<TValue> {
  return { past: [], future: [] };
}

export function canUndo<TValue>(history: History<TValue>): boolean {
  return history.past.length > 0;
}

export function canRedo<TValue>(history: History<TValue>): boolean {
  return history.future.length > 0;
}

interface CommitOptions {
  /**
   * Groups consecutive edits. Typically the field being edited
   * (`"item:3f2a:summary"`), so moving to another field breaks the run even inside
   * the time window. Omit for anything discrete — adding a section, reordering,
   * switching template — which must always be its own step.
   */
  coalesceKey?: string | null;
  /** Injected rather than read from `Date.now()`, so tests are deterministic. */
  now: number;
}

/**
 * Records a change.
 *
 * `previous` is pushed (that is what undo restores) and the redo stack is cleared,
 * because branching a history that the user cannot see is worse than losing the
 * branch. A commit where nothing changed is dropped: `Object.is` is exact here,
 * since Immer returns the same reference when a recipe touches nothing.
 */
export function commit<TValue>(
  history: History<TValue>,
  previous: TValue,
  next: TValue,
  { coalesceKey = null, now }: CommitOptions,
): History<TValue> {
  if (Object.is(previous, next)) {
    return history;
  }

  const top = history.past.at(-1);

  const continuesRun =
    top !== undefined &&
    coalesceKey !== null &&
    top.key === coalesceKey &&
    now - top.updatedAt <= HISTORY_LIMITS.coalesceWindowMs &&
    now - top.startedAt <= HISTORY_LIMITS.coalesceRunMs;

  if (continuesRun) {
    // The entry keeps its original `value` — the state before the run started —
    // and only its clock moves. That is what makes one undo cover the whole run.
    return {
      past: [...history.past.slice(0, -1), { ...top, updatedAt: now }],
      future: [],
    };
  }

  return {
    past: [...history.past, { value: previous, key: coalesceKey, startedAt: now, updatedAt: now }]
      // Oldest first, so dropping the overflow means dropping the oldest.
      .slice(-HISTORY_LIMITS.depth),
    future: [],
  };
}

export interface HistoryStep<TValue> {
  history: History<TValue>;
  value: TValue;
}

/**
 * Steps back. Returns `null` when there is nothing to undo, so the caller does not
 * have to check first and cannot accidentally write an unchanged state.
 */
export function undo<TValue>(
  history: History<TValue>,
  current: TValue,
): HistoryStep<TValue> | null {
  const top = history.past.at(-1);

  if (!top) {
    return null;
  }

  return {
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, HISTORY_LIMITS.depth),
    },
    value: top.value,
  };
}

/**
 * Steps forward.
 *
 * The re-pushed past entry carries `key: null`: a redone edit must never merge
 * with whatever the user types next, or redo followed by a keystroke would leave
 * one undo step covering both.
 */
export function redo<TValue>(
  history: History<TValue>,
  current: TValue,
  now: number,
): HistoryStep<TValue> | null {
  const [next, ...rest] = history.future;

  if (next === undefined) {
    return null;
  }

  return {
    history: {
      past: [...history.past, { value: current, key: null, startedAt: now, updatedAt: now }].slice(
        -HISTORY_LIMITS.depth,
      ),
      future: rest,
    },
    value: next,
  };
}
