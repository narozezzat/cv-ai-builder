/**
 * Ordering helpers for the editor's reorderable lists.
 *
 * Sections, items inside a section, bullet highlights, and social links are all
 * "an array the user can drag" — four places that would otherwise each grow their
 * own splice arithmetic, and splice arithmetic is where off-by-one lives.
 */

/**
 * A copy of `items` with the element at `from` moved to `to`.
 *
 * Out-of-range indices return the original array rather than throwing: a drop
 * target computed from a pointer event is not a trusted index, and losing a drag
 * is a better outcome than losing a row. The identity of the returned array is
 * unchanged in that case, which is also what Immer and the history reducer use to
 * decide nothing happened.
 */
export function moveArrayItem<TItem>(items: TItem[], from: number, to: number): TItem[] {
  if (
    from === to ||
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  ) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(from, 1);

  next.splice(to, 0, moved);

  return next;
}

/**
 * `items` with the element at `index` moved one place toward the given end.
 *
 * The keyboard affordance for a list that is otherwise drag-only. Returns the
 * original array at the ends, so a handler can call it unconditionally.
 */
export function nudgeArrayItem<TItem>(
  items: TItem[],
  index: number,
  direction: "up" | "down",
): TItem[] {
  return moveArrayItem(items, index, direction === "up" ? index - 1 : index + 1);
}
