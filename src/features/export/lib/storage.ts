/**
 * Where export files live, and for how long a link to one is valid.
 *
 * The bucket is private. Nothing here grants access — `exports_read_own` does, matching
 * `(storage.foldername(name))[1] = auth.uid()::text`, which is why `exportStoragePath`
 * puts the owner id first and why the render pipeline writes with the service role (there
 * is no insert or update policy at all).
 */

export const EXPORTS_BUCKET = "exports";

/**
 * Lifetime of the download link the action hands back.
 *
 * Five minutes, because the link is used immediately — the dialog triggers the download
 * as soon as the render resolves. A signed URL is a bearer token for one private object,
 * so it lives no longer than the click it exists for. The export history re-signs on
 * demand rather than storing a URL anywhere.
 */
export const EXPORT_SIGNED_URL_TTL_SECONDS = 300;
