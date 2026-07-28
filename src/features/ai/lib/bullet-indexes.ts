/**
 * Reconciles `bullets.improve`'s index-addressed answer with what was actually sent.
 *
 * The capability returns `{ index, text }` rather than a positional array, so a model
 * that improved four of six bullets can say which four. The output schema bounds
 * `index` to a non-negative integer and can go no further — a Zod schema has no view
 * of the input it is answering — which leaves the echo unverified until here.
 *
 * That matters because the caller applies these by index. An index past the end of
 * the request would write into a bullet the user never submitted, and a repeated
 * index would apply two different rewrites to one field. The request is the
 * authority; the model's numbering is a claim about it.
 */

export type IndexedText = {
  index: number;
  text: string;
};

export function reconcileBulletIndexes(
  items: readonly IndexedText[],
  sentCount: number,
): IndexedText[] {
  const seen = new Set<number>();
  const kept: IndexedText[] = [];

  for (const item of items) {
    if (!Number.isInteger(item.index) || item.index < 0 || item.index >= sentCount) continue;
    // First answer wins. Dropping both would lose a rewrite the user asked for; taking
    // the last would make the result depend on the model's ordering.
    if (seen.has(item.index)) continue;

    seen.add(item.index);
    kept.push(item);
  }

  // Ascending, so the diff the user reviews is in the order the bullets appear rather
  // than the order the model happened to emit them.
  return kept.sort((a, b) => a.index - b.index);
}
