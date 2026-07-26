"use server";

/**
 * Writes to the signed-in user's own profile row and avatar.
 *
 * SECURITY, in the order it matters:
 *
 * 1. A `"use server"` export is a public HTTP endpoint. Every action below
 *    re-parses its input with the same schema the form used — client-side
 *    validation is a courtesy to the user, never a control.
 * 2. The user id always comes from `requireUser()`. No action accepts one.
 * 3. Every write goes through the cookie-bound client, so RLS scopes it. The
 *    `.eq("id", user.id)` filters are for legibility, not for safety.
 * 4. No action writes `role` or `ai_credits`. RLS grants access per row, not per
 *    column, so `protect_profile_privileges()` in the functions migration is the
 *    actual barrier — this file is the second, independent one.
 */

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/components/shared/form";
import { getRequestContext, rateLimitSubject } from "@/lib/request";
import { enforceRateLimit, RATE_LIMITED_MESSAGE } from "@/services/rate-limit";
import { logActivity } from "@/services/supabase/admin";
import { createSupabaseServerClient, requireUser } from "@/services/supabase/server";
import type { ProfileUpdate } from "@/types/db";

import {
  AVATAR_BUCKET,
  avatarStoragePath,
  parseOwnedAvatarPath,
  validateAvatarFile,
  type AvatarMimeType,
} from "../lib/avatar";
import { PROFILE_RATE_LIMITS } from "../lib/rate-limits";
import {
  aiPreferencesSchema,
  appearanceSchema,
  profileInfoSchema,
  type AiPreferences,
  type AppearanceInput,
  type ProfileInfoInput,
} from "../schema/profile-schema";

const SAVE_FAILED = "Could not save your changes. Try again.";

/**
 * Applies a patch to the caller's row.
 *
 * `ProfileUpdate` is generated from the schema, so a typo in a column name is a
 * compile error. What it cannot prevent is a *valid* column that should not be
 * writable from here, which is why every caller passes a literal object with a
 * fixed key set rather than spreading user input.
 */
async function writeProfile(userId: string, patch: ProfileUpdate): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    console.error("[profile] update failed", { code: error.code, message: error.message });

    return SAVE_FAILED;
  }

  return null;
}

/**
 * Trims to `null`.
 *
 * An empty string and SQL `null` are the same intent from a form — "I cleared this
 * field" — but only one of them makes `full_name is null` mean what it looks like.
 */
function nullable(value: string): string | null {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

async function enforceProfileLimit(userId: string, rule = PROFILE_RATE_LIMITS.update) {
  return enforceRateLimit(rule, rateLimitSubject(`${rule.action}:user`, userId));
}

/**
 * The avatar and display name appear in the app shell on every page, so a save
 * has to invalidate the layout rather than just the settings route.
 */
function revalidateAccount(): void {
  revalidatePath("/", "layout");
}

// ── Identity ──────────────────────────────────────────────────────────────────

export async function updateProfileAction(input: ProfileInfoInput): Promise<ActionResult> {
  const parsed = profileInfoSchema.safeParse(input);

  if (!parsed.success) {
    return actionError("Check the form and try again.");
  }

  const user = await requireUser();
  const { allowed } = await enforceProfileLimit(user.id);

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const failure = await writeProfile(user.id, {
    full_name: nullable(parsed.data.fullName),
    headline: nullable(parsed.data.headline),
  });

  if (failure) {
    return actionError(failure);
  }

  const { ip, userAgent } = await getRequestContext();

  await logActivity({
    userId: user.id,
    action: "profile.update",
    entityType: "profile",
    entityId: user.id,
    ipAddress: ip,
    userAgent,
  });

  revalidateAccount();

  return actionSuccess("Profile saved.");
}

// ── Appearance ────────────────────────────────────────────────────────────────

/**
 * Persists theme and locale.
 *
 * The theme is applied client-side by `next-themes` the instant it is picked; this
 * only records the choice so it follows the user to another browser. That split is
 * intentional — waiting for a round-trip to repaint would make the toggle feel
 * broken, and a failed save should not leave the UI in a theme the user did not ask
 * for.
 */
export async function updateAppearanceAction(input: AppearanceInput): Promise<ActionResult> {
  const parsed = appearanceSchema.safeParse(input);

  if (!parsed.success) {
    return actionError("That is not a supported theme or language.");
  }

  const user = await requireUser();
  const { allowed } = await enforceProfileLimit(user.id);

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const failure = await writeProfile(user.id, {
    theme: parsed.data.theme,
    locale: parsed.data.locale,
  });

  if (failure) {
    return actionError(failure);
  }

  const { ip, userAgent } = await getRequestContext();

  await logActivity({
    userId: user.id,
    action: "profile.appearance_update",
    entityType: "profile",
    entityId: user.id,
    metadata: { theme: parsed.data.theme, locale: parsed.data.locale },
    ipAddress: ip,
    userAgent,
  });

  revalidateAccount();

  return actionSuccess("Appearance saved.");
}

// ── AI preferences ────────────────────────────────────────────────────────────

export async function updateAiPreferencesAction(input: AiPreferences): Promise<ActionResult> {
  const parsed = aiPreferencesSchema.safeParse(input);

  if (!parsed.success) {
    return actionError("Those preferences are not valid.");
  }

  const user = await requireUser();
  const { allowed } = await enforceProfileLimit(user.id);

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  // Whole-object write, not a merge. The schema is complete — every field has a
  // default — so writing all of it keeps the column from accumulating keys that
  // no longer mean anything.
  const failure = await writeProfile(user.id, { ai_preferences: parsed.data });

  if (failure) {
    return actionError(failure);
  }

  const { ip, userAgent } = await getRequestContext();

  await logActivity({
    userId: user.id,
    action: "profile.ai_preferences_update",
    entityType: "profile",
    entityId: user.id,
    metadata: parsed.data,
    ipAddress: ip,
    userAgent,
  });

  revalidateAccount();

  return actionSuccess("AI preferences saved.");
}

// ── Avatar ────────────────────────────────────────────────────────────────────

/** Reads the current avatar so a replaced one can be cleaned up. */
async function currentAvatarUrl(userId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", userId)
    .maybeSingle();

  return data?.avatar_url ?? null;
}

/**
 * Deletes a previous avatar, but only one this user owns in our own bucket.
 *
 * Best-effort by design: the profile row is already pointing at the new image, so a
 * failure here leaves an orphaned object, not a broken avatar. Logging it and
 * moving on beats failing a save the user already saw succeed.
 */
async function deleteOwnedAvatar(url: string | null, userId: string): Promise<void> {
  const key = parseOwnedAvatarPath(url, userId);

  if (!key) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([key]);

  if (error) {
    console.error("[profile] stale avatar cleanup failed", { key, message: error.message });
  }
}

/**
 * Uploads a new profile photo.
 *
 * Takes `FormData` because a `File` cannot cross a server-action boundary inside a
 * plain object. The file is validated here as well as in the uploader, and the
 * bucket's own `file_size_limit` / `allowed_mime_types` reject anything that gets
 * past both — three layers, of which only the last is a real control.
 */
export async function uploadAvatarAction(formData: FormData): Promise<ActionResult> {
  const file = formData.get("avatar");

  if (!(file instanceof File)) {
    return actionError("Choose an image to upload.");
  }

  const invalid = validateAvatarFile(file);

  if (invalid) {
    return actionError(invalid);
  }

  const user = await requireUser();
  const { allowed } = await enforceProfileLimit(user.id, PROFILE_RATE_LIMITS.avatarUpload);

  if (!allowed) {
    return actionError("Too many uploads. Try again later.");
  }

  const previous = await currentAvatarUrl(user.id);
  const path = avatarStoragePath(user.id, file.type as AvatarMimeType);
  const supabase = await createSupabaseServerClient();

  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    contentType: file.type,
    // A new random key per upload, so nothing is ever overwritten and the URL can
    // be cached hard. `upsert: false` makes a key collision an error rather than a
    // silent clobber of somebody's file.
    upsert: false,
    cacheControl: "31536000",
  });

  if (uploadError) {
    console.error("[profile] avatar upload failed", { message: uploadError.message });

    return actionError("Could not upload that image. Try again.");
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  const failure = await writeProfile(user.id, { avatar_url: publicUrl });

  if (failure) {
    // The row still points at the old image, so the object we just wrote is
    // unreferenced. Remove it rather than leaving it to be paid for forever.
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);

    return actionError(failure);
  }

  await deleteOwnedAvatar(previous, user.id);

  const { ip, userAgent } = await getRequestContext();

  await logActivity({
    userId: user.id,
    action: "profile.avatar_update",
    entityType: "profile",
    entityId: user.id,
    ipAddress: ip,
    userAgent,
  });

  revalidateAccount();

  return actionSuccess("Photo updated.");
}

export async function removeAvatarAction(): Promise<ActionResult> {
  const user = await requireUser();
  const { allowed } = await enforceProfileLimit(user.id);

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const previous = await currentAvatarUrl(user.id);
  const failure = await writeProfile(user.id, { avatar_url: null });

  if (failure) {
    return actionError(failure);
  }

  await deleteOwnedAvatar(previous, user.id);

  const { ip, userAgent } = await getRequestContext();

  await logActivity({
    userId: user.id,
    action: "profile.avatar_remove",
    entityType: "profile",
    entityId: user.id,
    ipAddress: ip,
    userAgent,
  });

  revalidateAccount();

  return actionSuccess("Photo removed.");
}
