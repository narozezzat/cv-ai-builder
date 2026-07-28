/**
 * Input shapes for every resume mutation and for the dashboard's list controls.
 *
 * Split from `@/types/resume`, which owns the *document* — the thing rendered and
 * exported. This file owns the *envelope*: ids, titles, tags, folder assignment,
 * and the concurrency token. The document schema is reused here rather than
 * re-described, so there is exactly one definition of a resume's contents.
 *
 * Isomorphic: no `server-only`, because the editor and the dashboard forms validate
 * with these before submitting, and every server action re-parses with the same
 * schema afterwards. The client copy is a courtesy; the server copy is the rule.
 */

import { z } from "zod";

import {
  DEFAULT_TEMPLATE_ID,
  resumeDocumentSchema,
  resumePageSchema,
  resumeThemeSchema,
} from "@/types/resume";

// ── Primitives ────────────────────────────────────────────────────────────────

/** Mirrors `check (char_length(title) between 1 and 200)` on `resumes.title`. */
export const RESUME_TITLE_MAX = 200;
/** Mirrors `check (char_length(name) between 1 and 80)` on `folders.name`. */
export const FOLDER_NAME_MAX = 80;
export const RESUME_TAG_MAX = 32;
/**
 * Tags are a filing aid, not a taxonomy. A cap keeps the dashboard's tag row from
 * becoming the page, and keeps `resumes.tags` from growing unbounded per row.
 */
export const RESUME_TAG_LIMIT = 12;
export const RESUME_SEARCH_MAX = 120;

export const DEFAULT_RESUME_TITLE = "Untitled resume";

export const resumeIdSchema = z.uuid("That resume id is not valid.");
export const folderIdSchema = z.uuid("That folder id is not valid.");

export const resumeTitleSchema = z
  .string()
  .trim()
  .min(1, "Give the resume a title.")
  .max(RESUME_TITLE_MAX, `Title must be ${RESUME_TITLE_MAX} characters or fewer.`);

export const folderNameSchema = z
  .string()
  .trim()
  .min(1, "Give the folder a name.")
  .max(FOLDER_NAME_MAX, `Name must be ${FOLDER_NAME_MAX} characters or fewer.`);

/**
 * `resumes.template_id` is a foreign key onto `resume_templates`, so an unknown id
 * is rejected by Postgres regardless. Matching the column's own slug check here
 * turns that from a 400 with a constraint name into a field error.
 */
export const templateIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "That template id is not valid.");

/** `null` is a real value: it means "not in any folder". */
export const folderAssignmentSchema = folderIdSchema.nullable();

/**
 * The optimistic-concurrency token, treated as opaque.
 *
 * It is whatever string PostgREST returned for `updated_at`, and it is compared
 * with `.eq()`, so the only property that matters is that it round-trips
 * byte-for-byte. Deliberately not parsed as a date and re-serialised: timestamptz
 * is microsecond-precision and arrives as `2026-07-26T09:02:00.123456+00:00`,
 * which `new Date().toISOString()` would flatten to milliseconds and `Z` — every
 * save would then match zero rows and report a phantom conflict.
 */
export const updatedAtTokenSchema = z
  .string()
  .trim()
  .min(20)
  .max(64)
  .refine((value) => Number.isFinite(Date.parse(value)), "That save token is not valid.");

// ── Tags ──────────────────────────────────────────────────────────────────────

/**
 * Drops blanks and collapses case-insensitive duplicates, keeping the first
 * spelling the user typed.
 *
 * Case-insensitive because "Backend" and "backend" filing a resume into two
 * buckets is a bug the user cannot see the cause of.
 */
function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const tag of tags) {
    const trimmed = tag.trim();
    const key = trimmed.toLowerCase();

    if (trimmed.length === 0 || seen.has(key)) {
      continue;
    }

    seen.add(key);
    kept.push(trimmed);
  }

  return kept;
}

export const tagsSchema = z
  .array(z.string().max(RESUME_TAG_MAX, `Tags must be ${RESUME_TAG_MAX} characters or fewer.`))
  // Bounded before the transform too: normalising a million-element array is work
  // done on behalf of an attacker.
  .max(RESUME_TAG_LIMIT * 4, `Use at most ${RESUME_TAG_LIMIT} tags.`)
  .transform(normalizeTags)
  .refine((tags) => tags.length <= RESUME_TAG_LIMIT, `Use at most ${RESUME_TAG_LIMIT} tags.`);

/** Splits the tag input's comma-separated text. Used by the form, not the action. */
export function parseTagInput(value: string): string[] {
  return normalizeTags(value.split(","));
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export const createResumeSchema = z.object({
  title: resumeTitleSchema.default(DEFAULT_RESUME_TITLE),
  templateId: templateIdSchema.default(DEFAULT_TEMPLATE_ID),
  folderId: folderAssignmentSchema.default(null),
});

export type CreateResumeInput = z.input<typeof createResumeSchema>;

export const duplicateResumeSchema = z.object({
  resumeId: resumeIdSchema,
});

export const renameResumeSchema = z.object({
  resumeId: resumeIdSchema,
  title: resumeTitleSchema,
});

export type RenameResumeInput = z.infer<typeof renameResumeSchema>;

export const setResumeFavoriteSchema = z.object({
  resumeId: resumeIdSchema,
  isFavorite: z.boolean(),
});

export const setResumeTagsSchema = z.object({
  resumeId: resumeIdSchema,
  tags: tagsSchema,
});

export const moveResumeSchema = z.object({
  resumeId: resumeIdSchema,
  folderId: folderAssignmentSchema,
});

export const resumeTargetSchema = z.object({
  resumeId: resumeIdSchema,
});

/**
 * The autosave payload.
 *
 * Carries the whole document rather than a patch. The document is one jsonb column
 * and a patch protocol would need its own conflict semantics on top of the
 * `expectedUpdatedAt` check that already exists — two mechanisms for one problem.
 */
export const saveResumeSchema = z.object({
  resumeId: resumeIdSchema,
  title: resumeTitleSchema,
  templateId: templateIdSchema,
  document: resumeDocumentSchema,
  theme: resumeThemeSchema,
  page: resumePageSchema,
  expectedUpdatedAt: updatedAtTokenSchema,
});

export type SaveResumeInput = z.infer<typeof saveResumeSchema>;

// ── Version history ───────────────────────────────────────────────────────────
//
// No document ever crosses this boundary. A snapshot is taken from the row the
// server just read, and a restore returns a document the server read — so the
// client cannot write history, only ask for it. That is why none of these schemas
// carry `content`.

/** Mirrors `check (char_length(label) <= 120)` on `resume_versions.label`. */
export const VERSION_LABEL_MAX = 120;

export const resumeVersionIdSchema = z.uuid("That version id is not valid.");

export const versionLabelSchema = z
  .string()
  .trim()
  .max(VERSION_LABEL_MAX, `A label must be ${VERSION_LABEL_MAX} characters or fewer.`);

/**
 * The origins a client is allowed to claim.
 *
 * The column also permits `ai`, `import`, and `restore`, but those are written by
 * the code that performs the act — a caller that could name itself `restore` could
 * forge the one entry in the history the user relies on to undo a restore.
 */
export const SNAPSHOT_ORIGINS = ["manual", "autosave"] as const;
export type SnapshotOrigin = (typeof SNAPSHOT_ORIGINS)[number];

/**
 * Every origin the column accepts, and how the history list names it.
 *
 * Wider than `SNAPSHOT_ORIGINS` because reading is not writing: the list has to
 * label an entry the server wrote, and an unknown value must still render — hence
 * the reader below rather than an enum parse that would drop the row.
 */
export const VERSION_ORIGINS = ["manual", "autosave", "ai", "import", "restore"] as const;
export type VersionOrigin = (typeof VERSION_ORIGINS)[number];

export const VERSION_ORIGIN_LABELS: Record<VersionOrigin, string> = {
  manual: "Saved",
  autosave: "Autosaved",
  ai: "AI edit",
  import: "Imported",
  restore: "Before restore",
};

export function readVersionOrigin(value: unknown): VersionOrigin {
  return VERSION_ORIGINS.includes(value as VersionOrigin) ? (value as VersionOrigin) : "manual";
}

export const createResumeVersionSchema = z.object({
  resumeId: resumeIdSchema,
  origin: z.enum(SNAPSHOT_ORIGINS).default("manual"),
  label: versionLabelSchema.default(""),
});

export type CreateResumeVersionInput = z.input<typeof createResumeVersionSchema>;

export const resumeVersionTargetSchema = z.object({
  resumeId: resumeIdSchema,
  versionId: resumeVersionIdSchema,
});

export type ResumeVersionTargetInput = z.infer<typeof resumeVersionTargetSchema>;

// ── Folders ───────────────────────────────────────────────────────────────────

export const createFolderSchema = z.object({
  name: folderNameSchema,
});

/**
 * The folder dialog's form shape.
 *
 * Create and rename share one form because they share one field; the `folderId`
 * that distinguishes them comes from props, not from the user, so it has no
 * business in the form state.
 */
export type FolderNameInput = z.infer<typeof createFolderSchema>;

export const renameFolderSchema = z.object({
  folderId: folderIdSchema,
  name: folderNameSchema,
});

export const deleteFolderSchema = z.object({
  folderId: folderIdSchema,
});

// ── List filters ──────────────────────────────────────────────────────────────

export const RESUME_SORTS = ["recent", "created", "title", "downloads"] as const;
export type ResumeSort = (typeof RESUME_SORTS)[number];

export const RESUME_SORT_LABELS: Record<ResumeSort, string> = {
  recent: "Last edited",
  created: "Date created",
  title: "Title A–Z",
  downloads: "Most downloaded",
};

/** Sentinel for "resumes in no folder", which a uuid cannot express. */
export const UNFILED_FOLDER = "none";

/**
 * Reads one query-string value.
 *
 * `searchParams` hands over `string | string[] | undefined` — repeated keys arrive
 * as an array, and `?q=a&q=b` is something anyone can type into the URL bar.
 */
function firstParam(value: unknown): string {
  if (Array.isArray(value)) {
    const [first] = value;

    return typeof first === "string" ? first : "";
  }

  return typeof value === "string" ? value : "";
}

const param = <TSchema extends z.ZodType>(schema: TSchema) => z.preprocess(firstParam, schema);

/**
 * Every field carries `.catch()`, so a malformed URL degrades to the default view
 * instead of throwing. The dashboard is the page a user lands on after fixing a
 * bad bookmark; it must not be the page that refuses to render because of one.
 */
export const resumeListFiltersSchema = z.object({
  q: param(z.string().trim().max(RESUME_SEARCH_MAX).catch("")),
  tag: param(z.string().trim().max(RESUME_TAG_MAX).catch("")),
  folderId: param(z.union([z.literal(""), z.literal(UNFILED_FOLDER), folderIdSchema]).catch("")),
  favorites: param(
    z
      .enum(["1", "true"])
      .transform(() => true)
      .catch(false),
  ),
  sort: param(z.enum(RESUME_SORTS).catch("recent")),
});

export type ResumeListFilters = z.infer<typeof resumeListFiltersSchema>;

export const DEFAULT_RESUME_LIST_FILTERS: ResumeListFilters = {
  q: "",
  tag: "",
  folderId: "",
  favorites: false,
  sort: "recent",
};

/** True when the list is unfiltered — the difference between "no resumes" and "no matches". */
export function hasActiveResumeFilters(filters: ResumeListFilters): boolean {
  return (
    filters.q.length > 0 ||
    filters.tag.length > 0 ||
    filters.folderId.length > 0 ||
    filters.favorites
  );
}

export function parseResumeListFilters(input: unknown): ResumeListFilters {
  const parsed = resumeListFiltersSchema.safeParse(input ?? {});

  return parsed.success ? parsed.data : DEFAULT_RESUME_LIST_FILTERS;
}
