/**
 * The diff behind "diff-against-current" in the suggestion popover.
 *
 * Hand-written rather than a dependency: the whole requirement is one LCS over two
 * short token arrays, it has to run in the browser bundle beside every AI-enabled
 * field, and a diff library brings a patch/apply surface this UI never touches. The
 * output is display-only — accepting a suggestion writes the model's text wholesale,
 * never a reconstruction from these segments — so a slightly coarse diff costs
 * nothing but a slightly coarse diff.
 *
 * Two granularities, because the two shapes of suggestion read differently:
 * prose changes a few words inside a sentence (word-level), while a bullet list
 * changes whole lines (line-level, one row per line).
 */

export type DiffOp = "equal" | "added" | "removed";

export interface DiffSegment {
  op: DiffOp;
  value: string;
}

/**
 * Above this, the O(n·m) table stops being free and the diff stops being readable
 * anyway — a rewrite of two thousand words is not something a user reads word by
 * word. Past it the answer degrades to "all of this became all of that", which is
 * both cheap and honest.
 */
const MAX_TOKENS = 1200;

/**
 * Word-level diff of two prose strings.
 *
 * Whitespace is normalized away: tokens are non-space runs, and segments re-join
 * with single spaces. The result is therefore not a faithful reproduction of either
 * input's formatting, which is fine for a read-only comparison and is the reason
 * accept does not rebuild the text from it.
 */
export function diffWords(before: string, after: string): DiffSegment[] {
  const beforeTokens = tokenizeWords(before);
  const afterTokens = tokenizeWords(after);

  if (beforeTokens.length > MAX_TOKENS || afterTokens.length > MAX_TOKENS) {
    return coarseDiff(beforeTokens.join(" "), afterTokens.join(" "));
  }

  return mergeSegments(diffTokens(beforeTokens, afterTokens), " ");
}

/**
 * Line-level diff, one segment per line and never merged.
 *
 * A bullet list is rendered as rows, so two consecutive added bullets must stay two
 * segments — merging them into one `"a\nb"` value would put two bullets in one row.
 */
export function diffLines(before: readonly string[], after: readonly string[]): DiffSegment[] {
  const beforeLines = before.map((line) => line.trim()).filter((line) => line.length > 0);
  const afterLines = after.map((line) => line.trim()).filter((line) => line.length > 0);

  if (beforeLines.length > MAX_TOKENS || afterLines.length > MAX_TOKENS) {
    return [
      ...beforeLines.map((value): DiffSegment => ({ op: "removed", value })),
      ...afterLines.map((value): DiffSegment => ({ op: "added", value })),
    ];
  }

  return diffTokens(beforeLines, afterLines);
}

/** Whether the suggestion differs from what is already there at all. */
export function hasDiffChanges(segments: readonly DiffSegment[]): boolean {
  return segments.some((segment) => segment.op !== "equal");
}

function tokenizeWords(text: string): string[] {
  return text.match(/\S+/g) ?? [];
}

function coarseDiff(before: string, after: string): DiffSegment[] {
  const segments: DiffSegment[] = [];

  if (before.length > 0) segments.push({ op: "removed", value: before });
  if (after.length > 0) segments.push({ op: "added", value: after });

  return segments;
}

/**
 * Longest common subsequence, backtracked into a segment list.
 *
 * The table holds LCS lengths for every suffix pair, filled bottom-up so the walk
 * forward from `(0, 0)` yields segments in reading order. On a tie the removal is
 * emitted first: "was X, now Y" is how the change is described in the UI, so the
 * deletion has to precede its replacement.
 */
function diffTokens(before: readonly string[], after: readonly string[]): DiffSegment[] {
  const rows = before.length;
  const cols = after.length;
  const stride = cols + 1;
  const table = new Uint32Array((rows + 1) * stride);

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i * stride + j] =
        before[i] === after[j]
          ? table[(i + 1) * stride + (j + 1)] + 1
          : Math.max(table[(i + 1) * stride + j], table[i * stride + (j + 1)]);
    }
  }

  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;

  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      segments.push({ op: "equal", value: before[i] });
      i += 1;
      j += 1;
    } else if (table[(i + 1) * stride + j] >= table[i * stride + (j + 1)]) {
      segments.push({ op: "removed", value: before[i] });
      i += 1;
    } else {
      segments.push({ op: "added", value: after[j] });
      j += 1;
    }
  }

  while (i < rows) {
    segments.push({ op: "removed", value: before[i] });
    i += 1;
  }

  while (j < cols) {
    segments.push({ op: "added", value: after[j] });
    j += 1;
  }

  return segments;
}

/** Collapses runs of one op into a single segment, so the UI renders fewer spans. */
function mergeSegments(segments: readonly DiffSegment[], joiner: string): DiffSegment[] {
  const merged: DiffSegment[] = [];

  for (const segment of segments) {
    const last = merged.at(-1);

    if (last?.op === segment.op) {
      last.value = `${last.value}${joiner}${segment.value}`;
      continue;
    }

    merged.push({ ...segment });
  }

  return merged;
}
