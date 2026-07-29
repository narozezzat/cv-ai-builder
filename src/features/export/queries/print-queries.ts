import "server-only";

/**
 * The read behind `/print/[token]`.
 *
 * SECURITY — this is the one place in the app that reads a resume with the service-role
 * client on behalf of a request that has no session, so the rules are narrow and worth
 * stating in full:
 *
 * 1. `userId` must come from a *verified* token payload, never from a URL parameter, a
 *    header, or a form field. `verifyPrintToken` is the only legitimate source.
 * 2. Both `id` and `user_id` are filtered. RLS is not in play here — the service-role key
 *    bypasses it by design — so the `.eq("user_id", …)` below is not belt-and-braces, it
 *    *is* the ownership check. Dropping it turns this into a read of any resume by id.
 * 3. Only the columns the renderer needs are selected. No `share_slug`, no `folder_id`,
 *    nothing the print page has no use for; a page that cannot see a value cannot leak it.
 *
 * `getResumeForEditor` is the cookie-bound sibling of this function and does the same
 * parsing. It is deliberately not reused: it builds its own client, and the whole point
 * here is a different one.
 */

import { getSupabaseAdminClient } from "@/services/supabase/admin";
import {
  readResumeDocument,
  readResumePage,
  readResumeTheme,
  type ResumeRenderInput,
} from "@/types/resume";

export interface PrintableResume extends ResumeRenderInput {
  /** Used for the export filename and the PDF's document title. Never rendered as HTML. */
  title: string;
}

/**
 * Why a print page could not be produced.
 *
 * Not surfaced: `/print` answers every failure with a 404, for the same reason the token
 * failures are collapsed. The distinction exists so the server log says which one it was.
 */
export type PrintableResumeFailure = "not-found" | "trashed" | "unreadable";

export type PrintableResumeResult =
  { ok: true; resume: PrintableResume } | { ok: false; reason: PrintableResumeFailure };

export async function getPrintableResume(input: {
  resumeId: string;
  userId: string;
}): Promise<PrintableResumeResult> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("resumes")
    .select("id, title, template_id, content, theme, page, deleted_at")
    .eq("id", input.resumeId)
    // SECURITY: the ownership check. See rule 2 in the header.
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) {
    console.error("[export] print load failed", { code: error.code, message: error.message });

    return { ok: false, reason: "not-found" };
  }

  if (!data) {
    return { ok: false, reason: "not-found" };
  }

  // A token minted before the resume was trashed is still cryptographically valid, and
  // rendering a trashed resume would hand back a file the user believes they deleted.
  if (data.deleted_at !== null) {
    return { ok: false, reason: "trashed" };
  }

  const document = readResumeDocument(data.content);

  if (!document.ok) {
    console.error("[export] stored document failed validation", {
      resumeId: input.resumeId,
      issues: document.issues,
    });

    return { ok: false, reason: "unreadable" };
  }

  return {
    ok: true,
    resume: {
      title: data.title,
      templateId: data.template_id,
      document: document.document,
      theme: readResumeTheme(data.theme),
      page: readResumePage(data.page),
    },
  };
}
