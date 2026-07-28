"use server";

/**
 * Every write to a resume: create, duplicate, metadata, trash, restore, permanent
 * delete, and the autosave path.
 *
 * SECURITY, in the order it matters:
 *
 * 1. A `"use server"` export is a public HTTP endpoint. Every action re-parses its
 *    input with the same schema the client used — the client copy is a courtesy.
 * 2. The user id always comes from `requireUser()`. No action accepts one, and no
 *    action accepts a `user_id` to write.
 * 3. Every statement goes through the cookie-bound client, so RLS decides which
 *    row it touches. The `.eq("id", resumeId)` filters narrow the statement; they
 *    do not authorize it. That is why an id belonging to someone else produces
 *    "not found" here rather than a permission error — the row is invisible, and
 *    saying "exists, but not yours" would confirm the id to whoever guessed it.
 * 4. Nothing here writes `view_count`, `download_count`, `share_slug`, or
 *    `visibility`. Counters are incremented by definer functions and sharing is
 *    its own surface, so a compromised form on this path cannot publish a resume.
 * 5. The document's rich-text fields go through `sanitizeResumeDocument` before the
 *    row is written. Zod bounds their length; it does not read the HTML, and the
 *    editor's schema is client-side. This is where that markup becomes trusted.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { actionError, actionSuccess, type ActionResult } from "@/components/shared/form";
import { getRequestContext, rateLimitSubject } from "@/lib/request";
import { routes } from "@/lib/routes";
import { enforceRateLimit, RATE_LIMITED_MESSAGE, type RateLimitRule } from "@/services/rate-limit";
import { logActivity } from "@/services/supabase/admin";
import {
  createSupabaseServerClient,
  requireUser,
  type SupabaseServerClient,
} from "@/services/supabase/server";
import { PG_ERROR, type ActivityLogInsert, type ResumeUpdate } from "@/types/db";
import { createResumeDocument, readResumeDocument, type ResumeDocument } from "@/types/resume";

import { isSameDocument } from "../lib/diff-document";
import { RESUME_RATE_LIMITS } from "../lib/rate-limits";
import { sanitizeResumeDocument } from "../lib/sanitize-document";
import {
  RESUME_TITLE_MAX,
  createFolderSchema,
  createResumeSchema,
  createResumeVersionSchema,
  deleteFolderSchema,
  duplicateResumeSchema,
  moveResumeSchema,
  readVersionOrigin,
  renameFolderSchema,
  renameResumeSchema,
  resumeTargetSchema,
  resumeVersionTargetSchema,
  saveResumeSchema,
  setResumeFavoriteSchema,
  setResumeTagsSchema,
  type CreateResumeInput,
  type CreateResumeVersionInput,
  type RenameResumeInput,
  type ResumeVersionTargetInput,
  type SaveResumeInput,
  type VersionOrigin,
} from "../schema/resume-schema";

const SAVE_FAILED = "Could not save your changes. Try again.";
const NOT_FOUND = "That resume could not be found.";
const INVALID_INPUT = "Check the form and try again.";
const EXPORTS_BUCKET = "exports";

// ── Shared plumbing ───────────────────────────────────────────────────────────

async function enforceResumeLimit(userId: string, rule: RateLimitRule) {
  return enforceRateLimit(rule, rateLimitSubject(`${rule.action}:user`, userId));
}

/**
 * Invalidates the lists a mutation can change.
 *
 * Scoped to the dashboard layout rather than the root: the grid, the trash count,
 * the folder sidebar, and the stat cards all live under it, and the builder route
 * deliberately does not — autosave calls this on a debounce, and revalidating the
 * page the user is typing on would fight the editor for the same state.
 */
function revalidateResumeLists(): void {
  revalidatePath(routes.dashboard, "layout");
}

/**
 * One audit entry, with the request context attached.
 *
 * `logActivity` uses the service-role client and never throws, so a failed audit
 * write cannot turn a save the user already saw succeed into an error.
 */
async function logResumeActivity(
  userId: string,
  action: string,
  resumeId: string | null,
  metadata?: ActivityLogInsert["metadata"],
): Promise<void> {
  const { ip, userAgent } = await getRequestContext();

  await logActivity({
    userId,
    action,
    entityType: "resume",
    entityId: resumeId,
    metadata,
    ipAddress: ip,
    userAgent,
  });
}

/**
 * Applies a patch to one active resume the caller owns.
 *
 * `.is("deleted_at", null)` is part of the match, not a nicety: renaming or
 * re-tagging a resume that is sitting in the trash would let the grid and the trash
 * view disagree about a row neither of them is currently showing. A zero-row result
 * is reported as not-found, which is also what an id from another account produces.
 *
 * Callers pass a literal patch object. `ResumeUpdate` would happily accept
 * `user_id`, so the column set is fixed at each call site rather than spread from
 * input.
 */
async function patchResume(resumeId: string, patch: ResumeUpdate): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("resumes")
    .update(patch)
    .eq("id", resumeId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[resume] update failed", { code: error.code, message: error.message });

    return SAVE_FAILED;
  }

  return data ? null : NOT_FOUND;
}

/**
 * Marks the document as touched.
 *
 * `updated_at` is maintained by the `resumes_set_updated_at` trigger, so it is never
 * written here — the trigger is what makes it trustworthy as a concurrency token.
 * `last_edited_at` is a separate, product-facing column ("edited 3 minutes ago"),
 * and only edits to content set it: adding a tag is not editing a resume.
 */
function touched(): { last_edited_at: string } {
  return { last_edited_at: new Date().toISOString() };
}

// ── Create and duplicate ──────────────────────────────────────────────────────

/**
 * Creates a resume seeded from the profile and sends the user into the editor.
 *
 * The redirect is why this returns no id on success: `redirect()` throws
 * `NEXT_REDIRECT`, so it lives after every fallible step and outside any `try`.
 */
export async function createResumeAction(input: CreateResumeInput): Promise<ActionResult> {
  const parsed = createResumeSchema.safeParse(input);

  if (!parsed.success) {
    return actionError(INVALID_INPUT);
  }

  const user = await requireUser();
  const { allowed } = await enforceResumeLimit(user.id, RESUME_RATE_LIMITS.create);

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const supabase = await createSupabaseServerClient();

  // Best-effort prefill. A missing profile row must not stop a resume being
  // created, so a failure here just means an emptier starting document.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, headline, email")
    .eq("id", user.id)
    .maybeSingle();

  const document = createResumeDocument({
    fullName: profile?.full_name ?? null,
    headline: profile?.headline ?? null,
    email: profile?.email ?? user.email ?? null,
  });

  const { data, error } = await supabase
    .from("resumes")
    .insert({
      // Explicit rather than relying on the column default: RLS's `with check`
      // compares this against `auth.uid()`, and stating it makes the row's owner
      // visible at the call site.
      user_id: user.id,
      title: parsed.data.title,
      template_id: parsed.data.templateId,
      folder_id: parsed.data.folderId,
      content: document,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[resume] create failed", { code: error?.code, message: error?.message });

    // A folder id from another account is invisible to the foreign key check, so
    // it surfaces as a violation rather than as a permission error.
    if (error?.code === PG_ERROR.FOREIGN_KEY_VIOLATION) {
      return actionError("That folder could not be found.");
    }

    return actionError("Could not create the resume. Try again.");
  }

  await logResumeActivity(user.id, "resume.create", data.id, {
    templateId: parsed.data.templateId,
  });

  revalidateResumeLists();
  redirect(routes.builder(data.id));
}

/** Keeps the copy suffix inside the column's 200-character check. */
function duplicateTitle(title: string): string {
  const suffix = " (copy)";
  const room = RESUME_TITLE_MAX - suffix.length;
  const base = title.length > room ? title.slice(0, room).trimEnd() : title;

  return `${base}${suffix}`;
}

/**
 * Copies a resume, document and all.
 *
 * Read-then-insert rather than an `insert … select`, which PostgREST cannot express.
 * The read is subject to the same policies as the write, so a source id the caller
 * cannot see yields not-found before anything is created.
 *
 * Deliberately *not* copied: share slug, visibility, counters, favourite. A
 * duplicate is a private draft — inheriting a public URL would republish content
 * the user only meant to fork.
 */
export async function duplicateResumeAction(input: unknown): Promise<ActionResult> {
  const parsed = duplicateResumeSchema.safeParse(input);

  if (!parsed.success) {
    return actionError(INVALID_INPUT);
  }

  const user = await requireUser();
  const { allowed } = await enforceResumeLimit(user.id, RESUME_RATE_LIMITS.create);

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const supabase = await createSupabaseServerClient();

  const { data: source, error: readError } = await supabase
    .from("resumes")
    .select("title, content, theme, page, template_id, folder_id, tags")
    .eq("id", parsed.data.resumeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (readError) {
    console.error("[resume] duplicate read failed", {
      code: readError.code,
      message: readError.message,
    });

    return actionError(SAVE_FAILED);
  }

  if (!source) {
    return actionError(NOT_FOUND);
  }

  const { data, error } = await supabase
    .from("resumes")
    .insert({
      user_id: user.id,
      title: duplicateTitle(source.title),
      content: source.content,
      theme: source.theme,
      page: source.page,
      template_id: source.template_id,
      folder_id: source.folder_id,
      tags: source.tags,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[resume] duplicate failed", { code: error?.code, message: error?.message });

    return actionError("Could not duplicate the resume. Try again.");
  }

  await logResumeActivity(user.id, "resume.duplicate", data.id, {
    sourceId: parsed.data.resumeId,
  });

  revalidateResumeLists();

  return actionSuccess("Resume duplicated.");
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function renameResumeAction(input: RenameResumeInput): Promise<ActionResult> {
  const parsed = renameResumeSchema.safeParse(input);

  if (!parsed.success) {
    return actionError(INVALID_INPUT, { title: "Give the resume a title." });
  }

  const user = await requireUser();
  const { allowed } = await enforceResumeLimit(user.id, RESUME_RATE_LIMITS.mutate);

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const failure = await patchResume(parsed.data.resumeId, { title: parsed.data.title });

  if (failure) {
    return actionError(failure);
  }

  await logResumeActivity(user.id, "resume.rename", parsed.data.resumeId);

  revalidateResumeLists();
  // The title is in the builder's header and in its <title>, so that route has to
  // be invalidated too — unlike autosave, a rename is a discrete user action and
  // cannot fight the editor for state.
  revalidatePath(routes.builder(parsed.data.resumeId));

  return actionSuccess("Resume renamed.");
}

export async function setResumeFavoriteAction(input: unknown): Promise<ActionResult> {
  const parsed = setResumeFavoriteSchema.safeParse(input);

  if (!parsed.success) {
    return actionError(INVALID_INPUT);
  }

  const user = await requireUser();
  const { allowed } = await enforceResumeLimit(user.id, RESUME_RATE_LIMITS.mutate);

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const failure = await patchResume(parsed.data.resumeId, { is_favorite: parsed.data.isFavorite });

  if (failure) {
    return actionError(failure);
  }

  revalidateResumeLists();

  return actionSuccess(
    parsed.data.isFavorite ? "Added to favourites." : "Removed from favourites.",
  );
}

export async function setResumeTagsAction(input: unknown): Promise<ActionResult> {
  const parsed = setResumeTagsSchema.safeParse(input);

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? INVALID_INPUT);
  }

  const user = await requireUser();
  const { allowed } = await enforceResumeLimit(user.id, RESUME_RATE_LIMITS.mutate);

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const failure = await patchResume(parsed.data.resumeId, { tags: parsed.data.tags });

  if (failure) {
    return actionError(failure);
  }

  revalidateResumeLists();

  return actionSuccess("Tags saved.");
}

export async function moveResumeToFolderAction(input: unknown): Promise<ActionResult> {
  const parsed = moveResumeSchema.safeParse(input);

  if (!parsed.success) {
    return actionError(INVALID_INPUT);
  }

  const user = await requireUser();
  const { allowed } = await enforceResumeLimit(user.id, RESUME_RATE_LIMITS.mutate);

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("resumes")
    .update({ folder_id: parsed.data.folderId })
    .eq("id", parsed.data.resumeId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[resume] move failed", { code: error.code, message: error.message });

    // The folder is only reachable through the caller's own policies, so a foreign
    // id fails the constraint instead of moving a resume into someone else's tree.
    return actionError(
      error.code === PG_ERROR.FOREIGN_KEY_VIOLATION
        ? "That folder could not be found."
        : SAVE_FAILED,
    );
  }

  if (!data) {
    return actionError(NOT_FOUND);
  }

  revalidateResumeLists();

  return actionSuccess(parsed.data.folderId ? "Resume moved." : "Resume removed from its folder.");
}

// ── Trash, restore, permanent delete ──────────────────────────────────────────

/**
 * Soft-deletes: sets `deleted_at`, keeps the row.
 *
 * The public share page stops resolving immediately, because `get_public_resume`
 * filters `deleted_at is null` — trashing is therefore also the fastest way to
 * unpublish, and no separate revocation step is needed here.
 */
export async function trashResumeAction(input: unknown): Promise<ActionResult> {
  const parsed = resumeTargetSchema.safeParse(input);

  if (!parsed.success) {
    return actionError(INVALID_INPUT);
  }

  const user = await requireUser();
  const { allowed } = await enforceResumeLimit(user.id, RESUME_RATE_LIMITS.mutate);

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const failure = await patchResume(parsed.data.resumeId, {
    deleted_at: new Date().toISOString(),
  });

  if (failure) {
    return actionError(failure);
  }

  await logResumeActivity(user.id, "resume.trash", parsed.data.resumeId);

  revalidateResumeLists();

  return actionSuccess("Moved to trash.");
}

/**
 * Clears `deleted_at`.
 *
 * Not routed through `patchResume`, whose `deleted_at is null` match would exclude
 * exactly the rows this action exists to touch. `resumes_select_own` and
 * `resumes_update_own` both include trashed rows, so restore needs no privileged
 * client.
 */
export async function restoreResumeAction(input: unknown): Promise<ActionResult> {
  const parsed = resumeTargetSchema.safeParse(input);

  if (!parsed.success) {
    return actionError(INVALID_INPUT);
  }

  const user = await requireUser();
  const { allowed } = await enforceResumeLimit(user.id, RESUME_RATE_LIMITS.mutate);

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("resumes")
    .update({ deleted_at: null })
    .eq("id", parsed.data.resumeId)
    .not("deleted_at", "is", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[resume] restore failed", { code: error.code, message: error.message });

    return actionError(SAVE_FAILED);
  }

  if (!data) {
    return actionError(NOT_FOUND);
  }

  await logResumeActivity(user.id, "resume.restore", parsed.data.resumeId);

  revalidateResumeLists();

  return actionSuccess("Resume restored.");
}

/**
 * Removes the export objects belonging to a set of resumes.
 *
 * Called *before* the rows go, because `exports.resume_id` is `on delete set null`:
 * after the resume is gone the rows survive with a null `resume_id` and nothing
 * left to associate their storage paths with, so the objects would be unreachable
 * and still billed.
 *
 * Best-effort by design. A storage failure must not block a deletion the user asked
 * for twice; the loss is a stale object, and it is logged.
 */
async function removeExportObjects(resumeIds: string[]): Promise<void> {
  if (resumeIds.length === 0) {
    return;
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("exports")
    .select("storage_path")
    .in("resume_id", resumeIds);

  if (error) {
    console.warn("[resume] could not list export objects to clean up", {
      code: error.code,
      message: error.message,
    });

    return;
  }

  const paths = (data ?? [])
    .map((row) => row.storage_path)
    .filter((path): path is string => typeof path === "string" && path.length > 0);

  if (paths.length === 0) {
    return;
  }

  // `exports_delete_own` scopes this to objects under the caller's own folder, so
  // a path from a row that somehow points elsewhere is refused by storage rather
  // than deleted.
  const { error: removeError } = await supabase.storage.from(EXPORTS_BUCKET).remove(paths);

  if (removeError) {
    console.warn("[resume] export cleanup failed", { message: removeError.message });
  }
}

/**
 * Permanent delete. Unrecoverable.
 *
 * Guarded on the resume already being in the trash, so no single click anywhere in
 * the UI can destroy a resume — the destructive path is always trash first, then
 * confirm. This is a plain `delete` under RLS, *not* `purge_trashed_resumes()`,
 * which is service-role-only and belongs to the scheduled retention job.
 */
export async function deleteResumeAction(input: unknown): Promise<ActionResult> {
  const parsed = resumeTargetSchema.safeParse(input);

  if (!parsed.success) {
    return actionError(INVALID_INPUT);
  }

  const user = await requireUser();
  const { allowed } = await enforceResumeLimit(user.id, RESUME_RATE_LIMITS.delete);

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing, error: readError } = await supabase
    .from("resumes")
    .select("id, deleted_at")
    .eq("id", parsed.data.resumeId)
    .maybeSingle();

  if (readError) {
    console.error("[resume] delete precheck failed", {
      code: readError.code,
      message: readError.message,
    });

    return actionError(SAVE_FAILED);
  }

  if (!existing) {
    return actionError(NOT_FOUND);
  }

  if (existing.deleted_at === null) {
    return actionError("Move the resume to trash before deleting it permanently.");
  }

  await removeExportObjects([parsed.data.resumeId]);

  const { error } = await supabase
    .from("resumes")
    .delete()
    .eq("id", parsed.data.resumeId)
    .not("deleted_at", "is", null);

  if (error) {
    console.error("[resume] delete failed", { code: error.code, message: error.message });

    return actionError("Could not delete the resume. Try again.");
  }

  // Logged with the id of a row that no longer exists, which is the point of an
  // audit trail: `activity_logs.entity_id` is a bare uuid with no foreign key, so
  // the record of the deletion outlives the thing deleted.
  await logResumeActivity(user.id, "resume.delete", parsed.data.resumeId);

  revalidateResumeLists();

  return actionSuccess("Resume deleted.");
}

/** Empties the trash in one pass. Unrecoverable. */
export async function emptyResumeTrashAction(): Promise<ActionResult> {
  const user = await requireUser();
  const { allowed } = await enforceResumeLimit(user.id, RESUME_RATE_LIMITS.delete);

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const supabase = await createSupabaseServerClient();

  const { data: trashed, error: readError } = await supabase
    .from("resumes")
    .select("id")
    .not("deleted_at", "is", null);

  if (readError) {
    console.error("[resume] trash read failed", {
      code: readError.code,
      message: readError.message,
    });

    return actionError(SAVE_FAILED);
  }

  const ids = (trashed ?? []).map((row) => row.id);

  if (ids.length === 0) {
    return actionSuccess("Trash is already empty.");
  }

  await removeExportObjects(ids);

  const { error } = await supabase.from("resumes").delete().not("deleted_at", "is", null);

  if (error) {
    console.error("[resume] empty trash failed", { code: error.code, message: error.message });

    return actionError("Could not empty the trash. Try again.");
  }

  await logResumeActivity(user.id, "resume.trash_empty", null, { count: ids.length });

  revalidateResumeLists();

  return actionSuccess(ids.length === 1 ? "1 resume deleted." : `${ids.length} resumes deleted.`);
}

// ── Autosave ──────────────────────────────────────────────────────────────────

/**
 * Autosave's own result type, not `ActionResult`.
 *
 * The editor needs the new `updated_at` back to keep the concurrency chain alive —
 * the token it holds is stale the instant a save lands — and it needs `conflict` as
 * a distinct outcome rather than an error string it would have to pattern-match.
 * The three cases map one-to-one onto the store's `markSaved` / `markConflict` /
 * `markError`.
 */
export type SaveResumeResult =
  | { status: "saved"; savedAt: string }
  | { status: "conflict" }
  | { status: "error"; message: string };

/**
 * Writes the whole document, but only if nobody else has written since the editor
 * last read it.
 *
 * `expectedUpdatedAt` is compared with `.eq()` as an opaque string — see
 * `updatedAtTokenSchema` for why it is never re-serialised through `Date`. A
 * zero-row result means either a conflict or a vanished row, and those need
 * different words in the UI, so the row is re-read to tell them apart.
 *
 * No activity log: autosave fires on a 1.5s debounce, and an entry per save would
 * bury every meaningful event in the audit trail under keystroke noise. Version
 * snapshots are the durable record of document change.
 */
export async function saveResumeAction(input: SaveResumeInput): Promise<SaveResumeResult> {
  const parsed = saveResumeSchema.safeParse(input);

  if (!parsed.success) {
    console.error("[resume] save rejected by validation", parsed.error.issues);

    return { status: "error", message: "This resume could not be saved. Reload and try again." };
  }

  const user = await requireUser();
  const { allowed } = await enforceResumeLimit(user.id, RESUME_RATE_LIMITS.save);

  if (!allowed) {
    return { status: "error", message: RATE_LIMITED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { resumeId, expectedUpdatedAt, document, theme, page, title, templateId } = parsed.data;

  const { data, error } = await supabase
    .from("resumes")
    .update({
      title,
      template_id: templateId,
      // The parsed document, not the raw input: defaults are applied and unknown
      // keys are gone, so what lands in `content` is exactly what the reshred
      // trigger and the renderer know how to read. Sanitized on top of that,
      // because the schema bounds the rich-text fields' length without looking
      // inside the HTML — this is the last point before that HTML becomes stored
      // markup the templates, the printer, and the public share page all render.
      content: sanitizeResumeDocument(document) satisfies ResumeDocument,
      theme,
      page,
      ...touched(),
    })
    .eq("id", resumeId)
    .eq("updated_at", expectedUpdatedAt)
    .is("deleted_at", null)
    .select("updated_at")
    .maybeSingle();

  if (error) {
    console.error("[resume] save failed", { code: error.code, message: error.message });

    return { status: "error", message: SAVE_FAILED };
  }

  if (data) {
    // The trigger has already advanced `updated_at`, so this is the next token.
    revalidatePath(routes.resumes);

    return { status: "saved", savedAt: data.updated_at };
  }

  const { data: current } = await supabase
    .from("resumes")
    .select("deleted_at")
    .eq("id", resumeId)
    .maybeSingle();

  if (!current) {
    return { status: "error", message: "This resume no longer exists." };
  }

  if (current.deleted_at !== null) {
    return { status: "error", message: "This resume is in the trash. Restore it to keep editing." };
  }

  return { status: "conflict" };
}

// ── Version history ───────────────────────────────────────────────────────────
//
// Four actions rather than four query functions, because the history dialog is a
// client component: it opens on demand, and a Server Component cannot fetch on a
// button press. That makes reads public endpoints too, so both of them re-parse
// their input and rely on RLS for the row filter exactly as the writes do.
//
// The client never sends a document on this path. A snapshot copies `content`
// straight out of the row the server just read, and a restore returns a document
// the server read — so history cannot be forged, only requested.

/**
 * Snapshots kept per resume; older ones are pruned as new ones land.
 *
 * A cap rather than a retention window: the user's mental model is "the last few
 * versions", and time-based expiry deletes the snapshot from before the holiday
 * precisely because it was the last safe point.
 */
const MAX_VERSIONS_PER_RESUME = 30;

/**
 * Minimum gap between two `autosave` snapshots of one resume.
 *
 * Autosave fires every 1.5s while typing. Without this, thirty snapshots of one
 * paragraph would evict every meaningful version in under a minute — the history
 * would be technically full and practically empty.
 */
const AUTOSAVE_SNAPSHOT_GAP_MS = 2 * 60 * 1000;

const VERSION_FIELDS = "id, version, label, origin, created_at";

/** History metadata. Never carries `content`: the list renders hundreds of rows. */
export interface ResumeVersionSummary {
  id: string;
  version: number;
  label: string;
  origin: VersionOrigin;
  createdAt: string;
}

export type ListResumeVersionsResult =
  { status: "ok"; versions: ResumeVersionSummary[] } | { status: "error"; message: string };

export type ReadResumeVersionResult =
  | { status: "ok"; version: ResumeVersionSummary; document: ResumeDocument }
  | { status: "error"; message: string };

export type CreateResumeVersionResult =
  | { status: "created"; version: ResumeVersionSummary }
  /** Nothing changed since the newest snapshot, or the autosave gap has not elapsed. */
  | { status: "skipped" }
  | { status: "error"; message: string };

export type RestoreResumeVersionResult =
  | { status: "ok"; document: ResumeDocument; snapshotOf: number }
  /** The stored version already matches what is open, so there is nothing to apply. */
  | { status: "unchanged" }
  | { status: "error"; message: string };

const VERSION_FAILED = "Could not reach the version history. Try again.";
const VERSION_NOT_FOUND = "That version could not be found.";
const VERSION_UNREADABLE = "That version was saved in a format this editor cannot read.";

type VersionRow = {
  id: string;
  version: number;
  label: string | null;
  origin: string;
  created_at: string;
};

function toVersionSummary(row: VersionRow): ResumeVersionSummary {
  return {
    id: row.id,
    version: row.version,
    // `label` is nullable in the column and always a string in the UI, so the
    // "no label" case is resolved once, here, instead of in every consumer.
    label: row.label ?? "",
    origin: readVersionOrigin(row.origin),
    createdAt: row.created_at,
  };
}

/**
 * Reads the resume's current document, or the reason it cannot be read.
 *
 * Both snapshot and restore need this: one to copy the document into history, the
 * other to record what the user is about to overwrite. Neither may proceed on an
 * unparseable row — snapshotting one would store the corruption, and restoring
 * over it would destroy the only copy of whatever the row actually holds.
 */
async function readCurrentDocument(
  supabase: SupabaseServerClient,
  resumeId: string,
): Promise<{ ok: true; document: ResumeDocument } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("resumes")
    .select("content, deleted_at")
    .eq("id", resumeId)
    .maybeSingle();

  if (error) {
    console.error("[resume] version read failed", { code: error.code, message: error.message });

    return { ok: false, message: VERSION_FAILED };
  }

  if (!data) {
    return { ok: false, message: NOT_FOUND };
  }

  if (data.deleted_at !== null) {
    return {
      ok: false,
      message: "This resume is in the trash. Restore it to use version history.",
    };
  }

  const document = readResumeDocument(data.content);

  if (!document.ok) {
    console.error("[resume] stored document failed validation", {
      resumeId,
      issues: document.issues,
    });

    return { ok: false, message: "This resume could not be read, so it cannot be snapshotted." };
  }

  return { ok: true, document: document.document };
}

/**
 * Drops everything older than the newest `MAX_VERSIONS_PER_RESUME` snapshots.
 *
 * Deletes by version number rather than by id list: `version` is assigned inside
 * the insert by `assign_resume_version()`, so it is monotonic per resume and a
 * single `lte` covers rows that appeared while this function was running. Failure
 * is logged and swallowed — an un-pruned history is untidy, and turning that into
 * a failed snapshot would lose the version the user asked for.
 */
async function pruneResumeVersions(
  supabase: SupabaseServerClient,
  resumeId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("resume_versions")
    .select("version")
    .eq("resume_id", resumeId)
    .order("version", { ascending: false })
    // The row one past the cap, if it exists: its version is the cutoff.
    .range(MAX_VERSIONS_PER_RESUME, MAX_VERSIONS_PER_RESUME);

  if (error) {
    console.error("[resume] version prune scan failed", { code: error.code });

    return;
  }

  const cutoff = data?.[0]?.version;

  if (cutoff === undefined) {
    return;
  }

  const { error: deleteError } = await supabase
    .from("resume_versions")
    .delete()
    .eq("resume_id", resumeId)
    .lte("version", cutoff);

  if (deleteError) {
    console.error("[resume] version prune failed", { code: deleteError.code });
  }
}

/** The newest snapshot with its document, used to decide whether a new one is worth storing. */
async function readNewestVersion(
  supabase: SupabaseServerClient,
  resumeId: string,
): Promise<{ createdAt: string; document: ResumeDocument } | null> {
  const { data, error } = await supabase
    .from("resume_versions")
    .select("content, created_at")
    .eq("resume_id", resumeId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const document = readResumeDocument(data.content);

  // An unreadable newest snapshot is treated as "no snapshot", so the next one
  // still gets stored instead of the history freezing on a bad row.
  return document.ok ? { createdAt: data.created_at, document: document.document } : null;
}

/** History metadata for one resume, newest first. */
export async function listResumeVersionsAction(input: unknown): Promise<ListResumeVersionsResult> {
  const parsed = resumeTargetSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: INVALID_INPUT };
  }

  await requireUser();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("resume_versions")
    .select(VERSION_FIELDS)
    .eq("resume_id", parsed.data.resumeId)
    .order("version", { ascending: false });

  if (error) {
    console.error("[resume] version list failed", { code: error.code, message: error.message });

    return { status: "error", message: VERSION_FAILED };
  }

  return { status: "ok", versions: (data ?? []).map(toVersionSummary) };
}

/**
 * One snapshot's document, for the diff the user reads before restoring.
 *
 * `resume_id` is part of the match as well as `id`: the version id alone is
 * authorized by RLS, but pairing them keeps a mismatched pair from returning a
 * document the dialog would then diff against the wrong resume.
 */
export async function readResumeVersionAction(input: unknown): Promise<ReadResumeVersionResult> {
  const parsed = resumeVersionTargetSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: INVALID_INPUT };
  }

  await requireUser();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("resume_versions")
    .select(`${VERSION_FIELDS}, content`)
    .eq("id", parsed.data.versionId)
    .eq("resume_id", parsed.data.resumeId)
    .maybeSingle();

  if (error) {
    console.error("[resume] version read failed", { code: error.code, message: error.message });

    return { status: "error", message: VERSION_FAILED };
  }

  if (!data) {
    return { status: "error", message: VERSION_NOT_FOUND };
  }

  const document = readResumeDocument(data.content);

  if (!document.ok) {
    console.error("[resume] stored version failed validation", {
      versionId: parsed.data.versionId,
      issues: document.issues,
    });

    return { status: "error", message: VERSION_UNREADABLE };
  }

  return { status: "ok", version: toVersionSummary(data), document: document.document };
}

/**
 * Snapshots the resume as it is stored right now.
 *
 * Deliberately reads `content` from the row instead of accepting a document: the
 * editor's draft may hold unsaved edits, and a history entry that never matched
 * any saved state is a restore target that reintroduces work the user discarded.
 * The manual-save path therefore snapshots *after* the save lands, not before.
 *
 * `version: 0` is a sentinel — `assign_resume_version()` replaces it with
 * `max(version) + 1` inside the insert, so two concurrent snapshots cannot both
 * compute the same number. `ResumeVersionInsert` requires the column, hence the 0
 * rather than an omission.
 */
export async function createResumeVersionAction(
  input: CreateResumeVersionInput,
): Promise<CreateResumeVersionResult> {
  const parsed = createResumeVersionSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: INVALID_INPUT };
  }

  const user = await requireUser();
  const { allowed } = await enforceResumeLimit(user.id, RESUME_RATE_LIMITS.version);

  if (!allowed) {
    return { status: "error", message: RATE_LIMITED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { resumeId, origin, label } = parsed.data;
  const current = await readCurrentDocument(supabase, resumeId);

  if (!current.ok) {
    return { status: "error", message: current.message };
  }

  const newest = await readNewestVersion(supabase, resumeId);

  if (newest) {
    if (isSameDocument(newest.document, current.document)) {
      return { status: "skipped" };
    }

    const elapsed = Date.now() - Date.parse(newest.createdAt);

    // Only autosave is throttled. A user pressing Cmd+S is asking for a marker in
    // the history, and refusing it would make the feature look broken.
    if (origin === "autosave" && Number.isFinite(elapsed) && elapsed < AUTOSAVE_SNAPSHOT_GAP_MS) {
      return { status: "skipped" };
    }
  }

  const { data, error } = await supabase
    .from("resume_versions")
    .insert({
      resume_id: resumeId,
      user_id: user.id,
      version: 0,
      content: current.document,
      label: label.length > 0 ? label : null,
      origin,
    })
    .select(VERSION_FIELDS)
    .single();

  if (error) {
    console.error("[resume] version create failed", { code: error.code, message: error.message });

    return { status: "error", message: "Could not save a version. Try again." };
  }

  await pruneResumeVersions(supabase, resumeId);

  // Only manual snapshots are audited. An autosave snapshot every two minutes is
  // the same keystroke noise `saveResumeAction` keeps out of the log.
  if (origin === "manual") {
    await logResumeActivity(user.id, "resume.version_create", resumeId, { version: data.version });
  }

  // No revalidation: the history is fetched by the dialog on open, and nothing
  // rendered on the server shows a version count.
  return { status: "created", version: toVersionSummary(data) };
}

/**
 * Snapshots what is open, then hands back the older document for the editor to install.
 *
 * The restore is *not* written here. The client installs the returned document
 * through the store's `replaceDocument`, so the change enters undo history and the
 * existing autosave persists it under the `expectedUpdatedAt` token the editor
 * already holds — writing `content` here would invalidate that token and the next
 * keystroke would report a phantom conflict.
 *
 * The pre-restore snapshot is what makes this safe to try: it is taken first, and a
 * failure to take it aborts the restore rather than proceeding without an undo path.
 */
export async function restoreResumeVersionAction(
  input: ResumeVersionTargetInput,
): Promise<RestoreResumeVersionResult> {
  const parsed = resumeVersionTargetSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: INVALID_INPUT };
  }

  const user = await requireUser();
  const { allowed } = await enforceResumeLimit(user.id, RESUME_RATE_LIMITS.version);

  if (!allowed) {
    return { status: "error", message: RATE_LIMITED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();
  const { resumeId, versionId } = parsed.data;

  const target = await supabase
    .from("resume_versions")
    .select("version, content")
    .eq("id", versionId)
    .eq("resume_id", resumeId)
    .maybeSingle();

  if (target.error) {
    console.error("[resume] restore read failed", {
      code: target.error.code,
      message: target.error.message,
    });

    return { status: "error", message: VERSION_FAILED };
  }

  if (!target.data) {
    return { status: "error", message: VERSION_NOT_FOUND };
  }

  const restored = readResumeDocument(target.data.content);

  if (!restored.ok) {
    console.error("[resume] restore target failed validation", {
      versionId,
      issues: restored.issues,
    });

    return { status: "error", message: VERSION_UNREADABLE };
  }

  const current = await readCurrentDocument(supabase, resumeId);

  if (!current.ok) {
    return { status: "error", message: current.message };
  }

  if (isSameDocument(current.document, restored.document)) {
    return { status: "unchanged" };
  }

  const { error: snapshotError } = await supabase.from("resume_versions").insert({
    resume_id: resumeId,
    user_id: user.id,
    version: 0,
    content: current.document,
    label: `Before restoring v${target.data.version}`,
    origin: "restore",
  });

  if (snapshotError) {
    console.error("[resume] pre-restore snapshot failed", {
      code: snapshotError.code,
      message: snapshotError.message,
    });

    return {
      status: "error",
      message: "Could not save a copy of your current version, so nothing was restored.",
    };
  }

  await pruneResumeVersions(supabase, resumeId);
  await logResumeActivity(user.id, "resume.version_restore", resumeId, {
    version: target.data.version,
  });

  return { status: "ok", document: restored.document, snapshotOf: target.data.version };
}

// ── Folders ───────────────────────────────────────────────────────────────────
//
// No activity log for folder writes: `activity_logs.entity_type` is constrained to
// resume/template/export/profile/auth, and a folder is a view over resumes rather
// than an asset of its own. Filing something differently is not an auditable event.

const FOLDER_NAME_TAKEN = "You already have a folder with that name.";

export async function createFolderAction(input: unknown): Promise<ActionResult> {
  const parsed = createFolderSchema.safeParse(input);

  if (!parsed.success) {
    return actionError(INVALID_INPUT, { name: parsed.error.issues[0]?.message ?? INVALID_INPUT });
  }

  const user = await requireUser();
  const { allowed } = await enforceResumeLimit(user.id, RESUME_RATE_LIMITS.folder);

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("folders")
    .insert({ user_id: user.id, name: parsed.data.name });

  if (error) {
    if (error.code === PG_ERROR.UNIQUE_VIOLATION) {
      return actionError(FOLDER_NAME_TAKEN, { name: FOLDER_NAME_TAKEN });
    }

    console.error("[resume] folder create failed", { code: error.code, message: error.message });

    return actionError("Could not create the folder. Try again.");
  }

  revalidateResumeLists();

  return actionSuccess("Folder created.");
}

export async function renameFolderAction(input: unknown): Promise<ActionResult> {
  const parsed = renameFolderSchema.safeParse(input);

  if (!parsed.success) {
    return actionError(INVALID_INPUT, { name: parsed.error.issues[0]?.message ?? INVALID_INPUT });
  }

  const user = await requireUser();
  const { allowed } = await enforceResumeLimit(user.id, RESUME_RATE_LIMITS.folder);

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("folders")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.folderId)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === PG_ERROR.UNIQUE_VIOLATION) {
      return actionError(FOLDER_NAME_TAKEN, { name: FOLDER_NAME_TAKEN });
    }

    console.error("[resume] folder rename failed", { code: error.code, message: error.message });

    return actionError(SAVE_FAILED);
  }

  if (!data) {
    return actionError("That folder could not be found.");
  }

  revalidateResumeLists();

  return actionSuccess("Folder renamed.");
}

/**
 * Deletes a folder, not its contents.
 *
 * `resumes.folder_id` is `on delete set null`, so the resumes inside become unfiled
 * and stay in the grid. Anything else would make a filing decision destructive.
 */
export async function deleteFolderAction(input: unknown): Promise<ActionResult> {
  const parsed = deleteFolderSchema.safeParse(input);

  if (!parsed.success) {
    return actionError(INVALID_INPUT);
  }

  const user = await requireUser();
  const { allowed } = await enforceResumeLimit(user.id, RESUME_RATE_LIMITS.folder);

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("folders").delete().eq("id", parsed.data.folderId);

  if (error) {
    console.error("[resume] folder delete failed", { code: error.code, message: error.message });

    return actionError("Could not delete the folder. Try again.");
  }

  revalidateResumeLists();

  return actionSuccess("Folder deleted. The resumes inside were kept.");
}
