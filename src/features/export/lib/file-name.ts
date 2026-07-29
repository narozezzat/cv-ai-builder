/**
 * Turns a resume title into two names: one for the storage object, one for the download.
 *
 * Both are derived, never taken from the client, and neither trusts the title — it is
 * user text that ends up in a filesystem-ish path and in a `Content-Disposition`-style
 * download name:
 *
 * - The storage path is `<userId>/<resumeId>/<timestamp>.<ext>`. The title is not in it
 *   at all: the `exports` bucket policies key ownership off the *first path segment*
 *   (`(storage.foldername(name))[1] = auth.uid()::text`), so anything that could inject
 *   a `/` into a segment is a policy bypass, not a cosmetic bug.
 * - The download name does carry the title, slugified: ASCII word characters and single
 *   hyphens only, so no path separators, no `..`, no control characters, no quotes to
 *   break out of a header value.
 */

import { EXPORT_FORMAT_DEFINITIONS, type ExportFormat } from "./export-formats";

/**
 * Long enough to stay recognisable in a downloads folder, short enough to leave room for
 * the extension inside the 255-byte limit every common filesystem shares.
 */
const MAX_SLUG_LENGTH = 60;

const FALLBACK_SLUG = "resume";

/**
 * Slug for the visible part of a download name.
 *
 * Deliberately an allowlist (`[^a-z0-9]`), not a denylist of bad characters: a denylist
 * has to anticipate every separator, every Unicode look-alike, and every normalisation
 * form, and missing one puts a `/` or a NUL in a filename.
 */
export function slugifyFileName(title: string): string {
  const slug = title
    .normalize("NFKD")
    // Strip combining marks so "Résumé" becomes "resume" rather than "rsum".
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    // A trailing hyphen can reappear after the slice.
    .replace(/-+$/g, "");

  return slug.length > 0 ? slug : FALLBACK_SLUG;
}

/** What the browser saves it as. */
export function exportFileName(title: string, format: ExportFormat): string {
  return `${slugifyFileName(title)}.${EXPORT_FORMAT_DEFINITIONS[format].extension}`;
}

/**
 * Object key inside the `exports` bucket.
 *
 * `<userId>/<resumeId>/<epoch ms>.<ext>` — the first segment is what the RLS policies
 * match, the second groups a resume's exports, and the timestamp keeps re-exports from
 * overwriting each other (the bucket has no update policy, so an overwrite would fail
 * rather than replace).
 */
export function exportStoragePath(input: {
  userId: string;
  resumeId: string;
  format: ExportFormat;
  timestamp: number;
}): string {
  const { extension } = EXPORT_FORMAT_DEFINITIONS[input.format];

  return `${input.userId}/${input.resumeId}/${input.timestamp}.${extension}`;
}
