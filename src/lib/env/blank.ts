/**
 * Treats a blank variable as an absent one.
 *
 * `.env.example` lists optional keys as bare `OPENAI_API_KEY=` so the reader can
 * see what exists before deciding to fill it in. Once loaded, that line is the
 * empty string, not `undefined` — so `z.string().min(1).optional()` rejects it
 * and the whole schema throws. Copying the documented template would break the
 * app, which makes this a correctness bug in the template's favour, not a lint.
 *
 * Whitespace counts as blank too: a value pasted with a trailing space is the
 * same mistake, and a key that is one space long is never a real credential.
 *
 * Deliberately not a trim of non-blank values. Silently rewriting a secret that
 * *does* have content hides the typo instead of surfacing it, and a provider
 * rejecting a malformed key is a clearer signal than us guessing at the fix.
 */
export function withoutBlanks<T extends Record<string, unknown>>(source: T): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(source) as [keyof T, T[keyof T]][]) {
    if (typeof value === "string" && value.trim() === "") {
      continue;
    }

    result[key] = value;
  }

  return result;
}
