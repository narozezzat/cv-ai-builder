/**
 * The shape every AI capability is flattened into before it reaches the popover.
 *
 * Fifteen capabilities return fifteen output types, and the review UI cares about
 * exactly two things: is this replacement prose, or is it a set of lines? So each
 * call site maps its capability's output into these, and one component handles
 * accept / reject / regenerate / diff for all of them. The alternative — a popover
 * per capability — is fifteen places to get the credit accounting and the undo
 * semantics right.
 *
 * `mode` is what separates a rewrite from an addition, and it is a property of the
 * capability rather than a user choice: `summary.generate` proposes text that stands
 * in for what is there, while `skills.suggest` proposes items to add. Presenting an
 * additive suggestion as a diff would imply accepting it deletes the rest.
 */

export interface TextSuggestion {
  kind: "text";
  /** Stable within one response; used as the React key and for variant paging. */
  id: string;
  /** Distinguishes variants in the footer, e.g. "Achievement-led". */
  label?: string;
  text: string;
  /** Model-supplied asides — keywords used, what changed, why. Display only. */
  notes?: string[];
}

export interface ListSuggestion {
  kind: "list";
  id: string;
  label?: string;
  items: string[];
  /**
   * `replace` diffs against the current list and swaps it wholesale on accept;
   * `append` renders checkboxes and merges the ticked items into what is there.
   */
  mode: "replace" | "append";
  notes?: string[];
}

export type AiSuggestion = TextSuggestion | ListSuggestion;

/** Ids only have to be unique inside one response, so the index is enough. */
export function suggestionId(prefix: string, index: number): string {
  return `${prefix}-${index}`;
}

/**
 * Merges chosen items into an existing list under the field's own rules.
 *
 * Deliberately the same semantics as `KeywordListField`'s commit path —
 * case-insensitive dedupe, trimmed, truncated to the per-item limit, stopped at the
 * cap — because accepting a suggestion must not be able to produce a list the user
 * could not have typed. A value over `maxLength` or a list over `maxItems` fails
 * `resumeDocumentSchema` at save time, long after the click that caused it.
 */
export function mergeListItems(
  current: readonly string[],
  additions: readonly string[],
  limits: { maxItems: number; maxLength: number },
): string[] {
  const merged = [...current];
  const seen = new Set(merged.map((item) => item.toLowerCase()));

  for (const addition of additions) {
    if (merged.length >= limits.maxItems) break;

    const value = addition.trim().slice(0, limits.maxLength);
    const key = value.toLowerCase();

    if (value.length === 0 || seen.has(key)) continue;

    seen.add(key);
    merged.push(value);
  }

  return merged;
}
