"use server";

/**
 * The one write the export feature owns: render a resume and hand back a link to the file.
 *
 * The sequence is deliberate — ownership is proved before a browser is launched, and the
 * row exists before the render starts so a crash mid-Chromium leaves a `failed` row rather
 * than nothing at all:
 *
 *   parse → session → configured? → rate limit → RLS-scoped read (ownership + title)
 *   → insert row (processing) → mint token → render → upload → row (completed) → sign URL
 *
 * SECURITY, in the order it matters:
 *
 * 1. `"use server"` is a public HTTP endpoint. The input is re-parsed here; the dialog's
 *    copy of the schema is a courtesy.
 * 2. The user id comes from `requireUser()`. The action accepts no user id, and the id it
 *    puts in the print token is the one from that session — which is what makes the token
 *    safe to hand to a cookie-less browser.
 * 3. The resume is read through the cookie-bound client, so RLS decides whether the row is
 *    visible. That read *is* the authorization: an id belonging to someone else comes back
 *    empty and is reported as "not found", never as "not yours".
 * 4. The `exports` row and the storage object are written with the service role, because
 *    the bucket has no insert policy and `insert` on the table is revoked from
 *    `authenticated`. A user cannot forge an export record claiming someone else's file.
 * 5. The storage path always begins with the owner's id, which is the segment
 *    `exports_read_own` matches. `exportStoragePath` is the only thing that builds it, and
 *    it never interpolates the title.
 * 6. Renderer errors are stored, never returned. A Chromium message carries absolute file
 *    paths and our own internal URL; the user gets one flat sentence.
 */

import { revalidatePath } from "next/cache";

import { getRequestContext, rateLimitSubject } from "@/lib/request";
import { routes } from "@/lib/routes";
import { isExportConfigured } from "@/lib/env/server";
import { enforceRateLimit, RATE_LIMITED_MESSAGE } from "@/services/rate-limit";
import { renderResume } from "@/services/render/chromium";
import { getSupabaseAdminClient, logActivity } from "@/services/supabase/admin";
import { createSupabaseServerClient, requireUser } from "@/services/supabase/server";
import { readResumePage } from "@/types/resume";

import { EXPORT_FORMAT_DEFINITIONS, type ExportFormat } from "../lib/export-formats";
import { exportFileName, exportStoragePath } from "../lib/file-name";
import { mintPrintToken } from "../lib/print-token";
import { EXPORT_RATE_LIMITS } from "../lib/rate-limits";
import { EXPORTS_BUCKET, EXPORT_SIGNED_URL_TTL_SECONDS } from "../lib/storage";
import { exportResumeSchema, type ExportResumeInput } from "../schema/export-schema";

const NOT_FOUND = "That resume could not be found.";
const INVALID_INPUT = "Check your selection and try again.";
const RENDER_FAILED = "We could not produce that file. Try again in a moment.";
const UNAVAILABLE = "Downloads are not available on this deployment yet.";
const TRASHED = "Restore this resume from the trash before exporting it.";

/**
 * Ceiling on the stored error text.
 *
 * A Chromium stack is kilobytes and the column is unbounded — a render that fails in a
 * loop would otherwise write a lot of prose into a support field nobody reads past the
 * first line of.
 */
const ERROR_MESSAGE_MAX = 500;

/**
 * The action's own result type.
 *
 * `ActionResult` from the form layer carries no data channel — it is `{ ok, message }` —
 * and this call has to return a URL and the name to save it under. Same discriminant, so
 * a caller can narrow it the same way.
 */
export type ExportResumeResult =
  | {
      ok: true;
      /** Signed, single-object, expires in `EXPORT_SIGNED_URL_TTL_SECONDS`. */
      url: string;
      fileName: string;
      format: ExportFormat;
      sizeBytes: number;
      /** PDF only. A screenshot has no page count. */
      pageCount: number | null;
    }
  | { ok: false; error: string };

export async function exportResume(input: ExportResumeInput): Promise<ExportResumeResult> {
  const parsed = exportResumeSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? INVALID_INPUT };
  }

  const { resumeId, format, scale } = parsed.data;
  const user = await requireUser();

  // Checked before the rate limit so a misconfigured deployment does not also burn the
  // user's hourly allowance telling them so.
  if (!isExportConfigured()) {
    console.error("[export] refused: EXPORT_TOKEN_SECRET or SUPABASE_SERVICE_ROLE_KEY is missing.");

    return { ok: false, error: UNAVAILABLE };
  }

  const { allowed } = await enforceRateLimit(
    EXPORT_RATE_LIMITS.render,
    rateLimitSubject(`${EXPORT_RATE_LIMITS.render.action}:user`, user.id),
  );

  if (!allowed) {
    return { ok: false, error: RATE_LIMITED_MESSAGE };
  }

  const supabase = await createSupabaseServerClient();

  // The ownership check and the filename source in one read. `page` comes along because
  // the renderer sizes the PDF box from it, and reading it here means the print route and
  // the browser agree on the sheet without a second query.
  const { data: resume, error: readError } = await supabase
    .from("resumes")
    .select("id, title, page, deleted_at")
    .eq("id", resumeId)
    .maybeSingle();

  if (readError) {
    console.error("[export] resume read failed", { code: readError.code });

    return { ok: false, error: NOT_FOUND };
  }

  if (!resume) {
    return { ok: false, error: NOT_FOUND };
  }

  if (resume.deleted_at !== null) {
    return { ok: false, error: TRASHED };
  }

  const admin = getSupabaseAdminClient();
  const startedAt = Date.now();

  // Inserted as `processing`, not `pending`: there is no queue here, the render begins on
  // the next line. `pending` exists in the enum for a future queued path.
  const { data: row, error: insertError } = await admin
    .from("exports")
    .insert({ user_id: user.id, resume_id: resume.id, format, status: "processing" })
    .select("id")
    .single();

  if (insertError || !row) {
    console.error("[export] could not open an export row", { code: insertError?.code });

    return { ok: false, error: RENDER_FAILED };
  }

  const storagePath = exportStoragePath({
    userId: user.id,
    resumeId: resume.id,
    format,
    timestamp: startedAt,
  });

  try {
    const rendered = await renderResume({
      // Minted here, from the verified session id — never from input. Two-minute life, so
      // it is worthless by the time it reaches a log.
      token: mintPrintToken({ resumeId: resume.id, userId: user.id }),
      format,
      page: readResumePage(resume.page),
      scale,
    });

    const { error: uploadError } = await admin.storage
      .from(EXPORTS_BUCKET)
      .upload(storagePath, rendered.bytes, {
        contentType: EXPORT_FORMAT_DEFINITIONS[format].mimeType,
        // The path carries a millisecond timestamp, so a collision means something is
        // wrong rather than a re-export. Failing is the honest outcome — and the bucket
        // has no update policy to overwrite through anyway.
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    await admin
      .from("exports")
      .update({
        status: "completed",
        storage_path: storagePath,
        file_size_bytes: rendered.bytes.byteLength,
        page_count: rendered.pageCount,
        duration_ms: Date.now() - startedAt,
        completed_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    // Signed with the *user's* client, not the admin one: creating the URL is then itself
    // an RLS-checked read through `exports_read_own`, so a bug in the path construction
    // above fails here instead of minting a link to another account's object.
    const { data: signed, error: signError } = await supabase.storage
      .from(EXPORTS_BUCKET)
      .createSignedUrl(storagePath, EXPORT_SIGNED_URL_TTL_SECONDS, {
        download: exportFileName(resume.title, format),
      });

    if (signError || !signed) {
      console.error("[export] could not sign the download URL", { message: signError?.message });

      return { ok: false, error: RENDER_FAILED };
    }

    const { ip, userAgent } = await getRequestContext();

    await logActivity({
      userId: user.id,
      action: "resume.export",
      entityType: "resume",
      entityId: resume.id,
      metadata: { format, scale, pageCount: rendered.pageCount },
      ipAddress: ip,
      userAgent,
    });

    // The dashboard's download count is derived from completed export rows, so the stat
    // cards are stale until this runs. The builder route is left alone on purpose — the
    // user is typing on it.
    revalidatePath(routes.dashboard, "layout");

    return {
      ok: true,
      url: signed.signedUrl,
      fileName: exportFileName(resume.title, format),
      format,
      sizeBytes: rendered.bytes.byteLength,
      pageCount: rendered.pageCount,
    };
  } catch (cause) {
    await failExport(row.id, cause, startedAt);

    return { ok: false, error: RENDER_FAILED };
  }
}

/**
 * Closes a failed render out in the ledger.
 *
 * Swallows its own errors: the caller is already on a failure path and returning a
 * different error because the *bookkeeping* also failed tells the user nothing new.
 */
async function failExport(exportId: string, cause: unknown, startedAt: number): Promise<void> {
  const message = cause instanceof Error ? cause.message : String(cause);

  console.error("[export] render failed", { exportId, message });

  try {
    await getSupabaseAdminClient()
      .from("exports")
      .update({
        status: "failed",
        error_message: message.slice(0, ERROR_MESSAGE_MAX),
        duration_ms: Date.now() - startedAt,
        completed_at: new Date().toISOString(),
      })
      .eq("id", exportId);
  } catch (bookkeeping) {
    console.error("[export] could not record the failure", bookkeeping);
  }
}
