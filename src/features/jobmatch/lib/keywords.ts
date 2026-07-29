/**
 * Keyword normalization, shared by both sides of the match.
 *
 * The scorer compares what a posting asks for against what a resume says, and both
 * are prose typed by different people. "APIs" must match "API", "Node.js" must match
 * "NodeJS", and "CI/CD" must match "CI/CD pipelines" — while "Go" must *never* match
 * inside "Google".
 *
 * Two rules make that safe:
 *
 * 1. **Matching happens on whole tokens, never on substrings.** `includesPhrase` slides
 *    a window over a token array and compares element by element, so word boundaries
 *    are structural rather than a regex we have to get right.
 * 2. **Both sides go through the same pipeline.** Lossy steps — stemming, dropping
 *    dots — are only ever applied symmetrically. A transform applied to both sides can
 *    produce a rare false positive ("bus" and "buses" collapsing onto something they
 *    shouldn't), but it can never produce a false *negative*, and a missed keyword is
 *    the expensive error here: it tells a user to add something they already have.
 *
 * `+` and `#` survive because they carry meaning in a name — `c++`, `c#`, `f#`. Dots
 * are removed rather than split so `node.js`, `Node.JS`, and `nodejs` all land on the
 * same token, and `.NET` on `net`.
 */

/** Combining marks left behind by NFD, so `Café` and `Cafe` normalize alike. */
const DIACRITICS = /\p{Diacritic}/gu;

/** Everything that is not part of a name becomes a separator — including `/` and `-`. */
const SEPARATORS = /[^a-z0-9+#]+/g;

/** A token has to carry at least one alphanumeric; `++` alone is punctuation. */
const HAS_ALNUM = /[a-z0-9]/;

/**
 * Endings where the `s` is part of the word: `class`, `status`, `focus`, `nodejs`.
 *
 * No English plural ends in `js`, so that ending is always a library name.
 *
 * Only the endings that could *collide* need guarding. Because stemming is symmetric,
 * over-stemming a word nobody else spells is harmless — `analysis` and `analysis` both
 * become `analysi` and still match. The cost only appears when the stem lands on a
 * different real term, which is why the guards are narrow rather than a word list.
 */
const NOT_PLURAL = /(ss|us|js)$/;

/**
 * Tokens whose stem is another term entirely: `ios` → `io`.
 *
 * The length guard below already protects the two-letter cases (`js`, `os`, `ts`).
 */
const NEVER_PLURAL = new Set(["ios"]);

/**
 * A light singularizer: trailing `s` only, and only on tokens long enough that the
 * `s` is unlikely to be load-bearing.
 *
 * Deliberately not a real stemmer. Porter would fold "management" and "manager" onto
 * one stem, which reads as a match the user cannot see in either text — and an
 * unexplainable match in a score we promised was explainable is worse than a miss.
 */
function singularize(token: string): string {
  if (token.length <= 3) return token;
  if (!token.endsWith("s")) return token;
  if (NOT_PLURAL.test(token) || NEVER_PLURAL.has(token)) return token;

  return token.slice(0, -1);
}

/**
 * One fragment of text as a run of comparable tokens.
 *
 * Callers must tokenize per *field*, not per concatenated blob: a phrase may only match
 * inside one run. "React" ending one bullet and "Native" starting the next is not
 * React Native.
 */
export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replaceAll(".", "")
    .replace(SEPARATORS, " ")
    .split(" ")
    .filter((token) => token.length > 0 && HAS_ALNUM.test(token))
    .map(singularize);
}

/**
 * Whether `phrase` appears in `tokens` as a contiguous run of whole tokens.
 *
 * An empty phrase matches nothing: a keyword that normalizes away entirely (`"---"`)
 * would otherwise match every resume and inflate the score.
 */
export function includesPhrase(tokens: readonly string[], phrase: readonly string[]): boolean {
  if (phrase.length === 0 || phrase.length > tokens.length) return false;

  for (let start = 0; start <= tokens.length - phrase.length; start += 1) {
    let matched = true;

    for (let offset = 0; offset < phrase.length; offset += 1) {
      if (tokens[start + offset] !== phrase[offset]) {
        matched = false;
        break;
      }
    }

    if (matched) return true;
  }

  return false;
}

/**
 * A requirement and its aliases as phrases to try, longest first.
 *
 * Longest first so the most specific form wins the report: a resume saying both
 * "Kubernetes" and "K8s" should be credited with the term the posting used, not
 * whichever alias happened to be listed first.
 */
export function phrasesFor(keyword: string, aliases: readonly string[] = []): string[][] {
  const seen = new Set<string>();
  const phrases: string[][] = [];

  for (const candidate of [keyword, ...aliases]) {
    const tokens = tokenize(candidate);

    if (tokens.length === 0) continue;

    const key = tokens.join(" ");

    if (seen.has(key)) continue;

    seen.add(key);
    phrases.push(tokens);
  }

  return phrases.sort((left, right) => right.length - left.length);
}
