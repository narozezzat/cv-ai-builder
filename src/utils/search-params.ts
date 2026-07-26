/**
 * Reading query strings in App Router pages.
 *
 * Next types `searchParams` values as `string | string[] | undefined`, because
 * `?next=/a&next=/b` is a legal URL. Every page that reads a parameter therefore
 * has to collapse that union before it can be used, and doing it inline in each
 * page is how one of them ends up interpolating an array into a redirect.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Promise form, which is how a Page receives it in Next 15. */
export type SearchParamsPromise = Promise<RawSearchParams>;

/**
 * The single value of a parameter, or `undefined`.
 *
 * A repeated parameter yields the first occurrence rather than the last: browsers
 * and our own links only ever send one, so a duplicate means the URL was crafted,
 * and taking the first is the reading a naive parser would produce — it denies an
 * attacker the trick of appending an override the earlier value hides.
 *
 * Empty strings (`?email=`) collapse to `undefined`, since a caller asking "is
 * this present" means "is there something usable here".
 */
export function param(params: RawSearchParams, key: string): string | undefined {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;

  return single === undefined || single === "" ? undefined : single;
}

/** Presence check for flag-style parameters such as `?sent=1`. */
export function flag(params: RawSearchParams, key: string): boolean {
  return param(params, key) !== undefined;
}
