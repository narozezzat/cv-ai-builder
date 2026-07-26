/**
 * Avatar rules, shared by the uploader (client) and the action (server).
 *
 * The bucket enforces the size and MIME limits itself, so nothing here is the
 * security boundary — it exists so the user gets "that file is 6 MB" before the
 * upload rather than a storage error after it. The one function that *is* about
 * safety is `parseOwnedAvatarPath`, which decides whether a stored URL may be
 * deleted.
 */

export const AVATAR_BUCKET = "avatars";

/** Matches `file_size_limit` on the bucket in the storage migration. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Matches `allowed_mime_types` on the bucket. No SVG: an SVG is a document that
 * can carry script, and the bucket is served from the app's own origin.
 */
export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];

/** For the file input's `accept`, so the OS picker filters before we have to. */
export const AVATAR_ACCEPT = AVATAR_MIME_TYPES.join(",");

const EXTENSIONS: Record<AvatarMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function isAvatarMimeType(value: string): value is AvatarMimeType {
  return (AVATAR_MIME_TYPES as readonly string[]).includes(value);
}

/**
 * Validates a picked file, returning a message to show or `null` when it passes.
 *
 * Takes the two fields it needs rather than a `File` so the server action can run
 * the identical check against a `FormData` entry without constructing one.
 */
export function validateAvatarFile(file: { type: string; size: number }): string | null {
  if (!isAvatarMimeType(file.type)) {
    return "Choose a JPEG, PNG, or WebP image.";
  }

  if (file.size === 0) {
    return "That file is empty.";
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return `Images must be under ${Math.round(AVATAR_MAX_BYTES / 1024 / 1024)} MB.`;
  }

  return null;
}

/**
 * Builds the storage key for a new avatar.
 *
 * SECURITY: `<user_id>/<filename>` is load-bearing. Every policy on the bucket
 * authorizes on `(storage.foldername(name))[1] = auth.uid()::text`, so the id must
 * come from a verified session and never from anything the client sent.
 *
 * The random segment is deliberate. Overwriting a stable key like `<id>/avatar.jpg`
 * would leave every cache — browser, CDN, and whatever Slack unfurled the shared
 * resume into — serving the old image at the same URL. A new key per upload makes
 * the URL change with the picture.
 */
export function avatarStoragePath(userId: string, mimeType: AvatarMimeType): string {
  return `${userId}/${crypto.randomUUID()}.${EXTENSIONS[mimeType]}`;
}

const PUBLIC_OBJECT_PREFIX = `/storage/v1/object/public/${AVATAR_BUCKET}/`;

/**
 * Recovers the storage key from a public avatar URL, but only if the caller owns it.
 *
 * SECURITY: this gates a delete. `profiles.avatar_url` is a text column a user can
 * write freely, so without the ownership check a user could point it at another
 * user's avatar and have our own cleanup remove it. Returns `null` for anything
 * that is not our bucket or not the caller's folder — which is also the normal
 * case for OAuth avatars, since those are hosted by Google or GitHub.
 */
export function parseOwnedAvatarPath(avatarUrl: string | null, userId: string): string | null {
  if (!avatarUrl) {
    return null;
  }

  let pathname: string;

  try {
    pathname = new URL(avatarUrl).pathname;
  } catch {
    return null;
  }

  if (!pathname.startsWith(PUBLIC_OBJECT_PREFIX)) {
    return null;
  }

  const key = decodeURIComponent(pathname.slice(PUBLIC_OBJECT_PREFIX.length));

  return key.startsWith(`${userId}/`) ? key : null;
}

/**
 * Initials for the fallback face, at most two characters.
 *
 * Falls back through name → email → "?" so there is always something to render;
 * an empty circle reads as a broken image rather than a missing photo.
 */
export function avatarInitials(fullName: string | null, email: string | null): string {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);

  if (words.length > 0) {
    const first = words[0]?.charAt(0) ?? "";
    const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? "") : "";

    return `${first}${last}`.toUpperCase();
  }

  const local = (email ?? "").trim();

  return local.length > 0 ? local.slice(0, 2).toUpperCase() : "?";
}
