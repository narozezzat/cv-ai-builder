/**
 * Reads for the dashboard grid, the trash view, and the editor.
 *
 * Same contract as the profile queries: everything goes through the cookie-bound
 * client, so RLS is what scopes the rows. The filters here are the user's own
 * choices — folder, tag, search — not an authorization boundary, and none of them
 * carries a `user_id` predicate. `auth.uid()` in the policy is the guarantee; a
 * `.eq("user_id", …)` in TypeScript would only be a second place to forget it.
 *
 * Failures log and return an empty result rather than throwing. A dashboard that
 * renders "couldn't load your resumes" is recoverable; one that 500s is not.
 */

import "server-only";

import { cache } from "react";

import { createSupabaseServerClient } from "@/services/supabase/server";
import {
  type FolderSummary,
  RESUME_SUMMARY_COLUMNS,
  type ResumeSummary,
  type ResumeTagSummary,
  type ResumeVisibility,
} from "@/types/db";
import {
  type ResumeDocument,
  type ResumePage,
  type ResumeTheme,
  readResumeDocument,
  readResumePage,
  readResumeTheme,
} from "@/types/resume";

import { type ResumeListFilters, UNFILED_FOLDER } from "../schema/resume-schema";

/**
 * Hard ceiling on a single listing.
 *
 * The grid is not paginated yet, and an unbounded select is a payload whose size is
 * decided by whoever has the most resumes. 200 is far past what a real person has
 * and small enough to render in one pass.
 */
const LIST_LIMIT = 200;

// ── Listing ───────────────────────────────────────────────────────────────────

/**
 * Active (non-trashed) resumes matching the dashboard's filters.
 *
 * The `deleted_at is null` predicate matches `resumes_user_active_idx` exactly, so
 * the default view is an index scan rather than a filter over every row the user
 * has ever created.
 */
export async function listResumes(filters: ResumeListFilters): Promise<ResumeSummary[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("resumes")
    .select(RESUME_SUMMARY_COLUMNS)
    .is("deleted_at", null)
    .limit(LIST_LIMIT);

  if (filters.q.length > 0) {
    // `websearch` and not `plain`/`phrase`: websearch_to_tsquery accepts arbitrary
    // human text, including stray quotes and operators, where to_tsquery raises a
    // syntax error — and this string comes straight from a search box.
    query = query.textSearch("search_vector", filters.q, { type: "websearch" });
  }

  if (filters.tag.length > 0) {
    query = query.contains("tags", [filters.tag]);
  }

  if (filters.folderId === UNFILED_FOLDER) {
    query = query.is("folder_id", null);
  } else if (filters.folderId.length > 0) {
    query = query.eq("folder_id", filters.folderId);
  }

  if (filters.favorites) {
    query = query.eq("is_favorite", true);
  }

  switch (filters.sort) {
    case "created":
      query = query.order("created_at", { ascending: false });
      break;
    case "title":
      query = query.order("title", { ascending: true });
      break;
    case "downloads":
      query = query.order("download_count", { ascending: false });
      break;
    default:
      query = query.order("last_edited_at", { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    console.error("[resume] list failed", { code: error.code, message: error.message });

    return [];
  }

  return data ?? [];
}

/**
 * Trashed resumes, most recently trashed first.
 *
 * Readable because `resumes_select_own` deliberately does not filter `deleted_at` —
 * restoring your own resume must not need a privileged client.
 */
export async function listTrashedResumes(): Promise<ResumeSummary[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("resumes")
    .select(RESUME_SUMMARY_COLUMNS)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) {
    console.error("[resume] trash list failed", { code: error.code, message: error.message });

    return [];
  }

  return data ?? [];
}

// ── Editor ────────────────────────────────────────────────────────────────────

/** The editor's view of a resume: envelope columns plus the parsed document. */
export interface ResumeEditorRecord {
  id: string;
  title: string;
  templateId: string;
  document: ResumeDocument;
  theme: ResumeTheme;
  page: ResumePage;
  folderId: string | null;
  visibility: ResumeVisibility;
  shareSlug: string | null;
  /** The concurrency token, exactly as Postgres returned it. */
  updatedAt: string;
}

/**
 * Why the editor could not open a resume.
 *
 * `unreadable` is separate from `not-found` on purpose. A document that fails
 * validation is a document we must not open, because opening it means the editor
 * would seed itself from defaults and the first autosave would overwrite the user's
 * real content with blankness. Refusing, and saying so, keeps the row recoverable.
 */
export type ResumeEditorFailure = "not-found" | "trashed" | "unreadable";

export type ResumeEditorResult =
  { ok: true; resume: ResumeEditorRecord } | { ok: false; reason: ResumeEditorFailure };

export async function getResumeForEditor(resumeId: string): Promise<ResumeEditorResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("resumes")
    .select(
      "id, title, template_id, content, theme, page, folder_id, visibility, share_slug, deleted_at, updated_at",
    )
    .eq("id", resumeId)
    .maybeSingle();

  if (error) {
    console.error("[resume] editor load failed", { code: error.code, message: error.message });

    return { ok: false, reason: "not-found" };
  }

  // Someone else's resume and a nonexistent one are indistinguishable here, which
  // is the correct behaviour: RLS filters the row out, and reporting "exists but
  // not yours" would confirm the id to whoever guessed it.
  if (!data) {
    return { ok: false, reason: "not-found" };
  }

  if (data.deleted_at !== null) {
    return { ok: false, reason: "trashed" };
  }

  const document = readResumeDocument(data.content);

  if (!document.ok) {
    console.error("[resume] stored document failed validation", {
      resumeId,
      issues: document.issues,
    });

    return { ok: false, reason: "unreadable" };
  }

  return {
    ok: true,
    resume: {
      id: data.id,
      title: data.title,
      templateId: data.template_id,
      document: document.document,
      // Theme and page fall back to defaults rather than failing the load: unlike
      // the document they carry no user prose, so a bad value costs an appearance
      // setting, and the next save rewrites it.
      theme: readResumeTheme(data.theme),
      page: readResumePage(data.page),
      folderId: data.folder_id,
      visibility: data.visibility,
      shareSlug: data.share_slug,
      updatedAt: data.updated_at,
    },
  };
}

// ── Folders and tags ──────────────────────────────────────────────────────────

/**
 * Folders with their resume counts.
 *
 * Two round-trips instead of one: PostgREST can embed a count of a related table,
 * but not a count filtered on the related table's own `deleted_at`, so an embedded
 * count would include trashed resumes and disagree with the grid beside it.
 *
 * Memoized per request: the folder rail and the grid's "move to folder" menu suspend
 * on this independently, and two boundaries wanting the same list must not cost two
 * pairs of round-trips.
 */
export const listFolders = cache(async (): Promise<FolderSummary[]> => {
  const supabase = await createSupabaseServerClient();

  const [folders, filed] = await Promise.all([
    supabase
      .from("folders")
      .select("id, name, color, sort_order")
      .order("sort_order")
      .order("name"),
    supabase
      .from("resumes")
      .select("folder_id")
      .is("deleted_at", null)
      .not("folder_id", "is", null),
  ]);

  if (folders.error) {
    console.error("[resume] folder list failed", {
      code: folders.error.code,
      message: folders.error.message,
    });

    return [];
  }

  const counts = new Map<string, number>();

  if (filed.error) {
    // Counts are decoration; the folders themselves are navigation. Losing the
    // former must not remove the latter.
    console.error("[resume] folder counts failed", {
      code: filed.error.code,
      message: filed.error.message,
    });
  } else {
    for (const row of filed.data ?? []) {
      if (row.folder_id !== null) {
        counts.set(row.folder_id, (counts.get(row.folder_id) ?? 0) + 1);
      }
    }
  }

  return (folders.data ?? []).map((folder) => ({
    ...folder,
    resumeCount: counts.get(folder.id) ?? 0,
  }));
});

/**
 * Every tag the user has used, with usage counts, most-used first.
 *
 * Aggregated in TypeScript rather than SQL because `tags` is a `text[]`: the
 * equivalent query is an `unnest` + `group by`, which PostgREST cannot express and
 * which would need an RPC of its own for a list bounded at 12 tags per row.
 */
export async function listResumeTags(): Promise<ResumeTagSummary[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("resumes")
    .select("tags")
    .is("deleted_at", null)
    .limit(LIST_LIMIT);

  if (error) {
    console.error("[resume] tag list failed", { code: error.code, message: error.message });

    return [];
  }

  const counts = new Map<string, ResumeTagSummary>();

  for (const row of data ?? []) {
    for (const tag of row.tags) {
      // Grouped case-insensitively, matching how `tagsSchema` dedupes, but the
      // first spelling seen is what gets shown.
      const key = tag.toLowerCase();
      const existing = counts.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { tag, count: 1 });
      }
    }
  }

  return [...counts.values()].sort(
    (left, right) => right.count - left.count || left.tag.localeCompare(right.tag),
  );
}

/**
 * Totals for the folder rail's "All resumes" and "Unfiled" rows.
 *
 * Deliberately not derived from the grid's own result set: that one is filtered,
 * and a sidebar whose counts change when you search is a sidebar that can't be
 * used to navigate. Both are `head: true` counts, so neither transfers rows.
 */
export async function getResumeCounts(): Promise<{ total: number; unfiled: number }> {
  const supabase = await createSupabaseServerClient();

  const [total, unfiled] = await Promise.all([
    supabase.from("resumes").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase
      .from("resumes")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .is("folder_id", null),
  ]);

  if (total.error || unfiled.error) {
    console.error("[resume] counts failed", {
      total: total.error?.message,
      unfiled: unfiled.error?.message,
    });
  }

  return { total: total.count ?? 0, unfiled: unfiled.count ?? 0 };
}

/** Trash badge count. Cheap: `head: true` fetches no rows. */
export async function countTrashedResumes(): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const { count, error } = await supabase
    .from("resumes")
    .select("id", { count: "exact", head: true })
    .not("deleted_at", "is", null);

  if (error) {
    console.error("[resume] trash count failed", { code: error.code, message: error.message });

    return 0;
  }

  return count ?? 0;
}
