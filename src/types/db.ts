/**
 * Hand-written conveniences over the generated database types.
 *
 * Deliberately a separate module: `database.ts` is overwritten wholesale by
 * `pnpm gen:types`, so anything written by hand has to live outside it or it
 * disappears on the next regeneration.
 */

import type { Database, Enums, Tables, TablesInsert, TablesUpdate } from "@/types/database";

export type { Database, Json } from "@/types/database";
export type { Tables, TablesInsert, TablesUpdate, Enums } from "@/types/database";

// ── Enums ─────────────────────────────────────────────────────────────────────

export type UserRole = Enums<"user_role">;
export type ResumeVisibility = Enums<"resume_visibility">;
export type ExportFormat = Enums<"export_format">;
export type ExportStatus = Enums<"export_status">;
export type SubscriptionPlan = Enums<"subscription_plan">;
export type SubscriptionStatus = Enums<"subscription_status">;

/**
 * Runtime values for the Postgres enums.
 *
 * The generated types give compile-time membership only, and a Zod schema
 * validating user input needs actual values. These arrays are asserted against
 * the generated union below, so adding a variant to the enum in a migration and
 * forgetting it here is a type error rather than a silent gap in validation.
 */
export const USER_ROLES = ["user", "admin"] as const satisfies readonly UserRole[];
export const RESUME_VISIBILITIES = [
  "private",
  "unlisted",
  "public",
] as const satisfies readonly ResumeVisibility[];
export const EXPORT_FORMATS = ["pdf", "png", "jpeg"] as const satisfies readonly ExportFormat[];
export const EXPORT_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const satisfies readonly ExportStatus[];
export const SUBSCRIPTION_PLANS = [
  "free",
  "pro",
  "team",
] as const satisfies readonly SubscriptionPlan[];
export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
] as const satisfies readonly SubscriptionStatus[];

// The reverse direction: every generated variant must appear in the array above.
// `satisfies` alone only proves the array holds no *invalid* members.
type AssertExhaustive<TUnion, TListed extends TUnion> = [TUnion] extends [TListed] ? true : never;

export type _EnumsAreExhaustive = [
  AssertExhaustive<UserRole, (typeof USER_ROLES)[number]>,
  AssertExhaustive<ResumeVisibility, (typeof RESUME_VISIBILITIES)[number]>,
  AssertExhaustive<ExportFormat, (typeof EXPORT_FORMATS)[number]>,
  AssertExhaustive<ExportStatus, (typeof EXPORT_STATUSES)[number]>,
  AssertExhaustive<SubscriptionPlan, (typeof SUBSCRIPTION_PLANS)[number]>,
  AssertExhaustive<SubscriptionStatus, (typeof SUBSCRIPTION_STATUSES)[number]>,
];

// ── Row aliases ───────────────────────────────────────────────────────────────
//
// `Tables<"resumes">` is perfectly usable; these exist because the alternative
// is every module in the app spelling the same generic out, and a rename in the
// schema then touching a hundred files instead of this one.

export type ProfileRow = Tables<"profiles">;
export type ProfileUpdate = TablesUpdate<"profiles">;

export type FolderRow = Tables<"folders">;
export type FolderInsert = TablesInsert<"folders">;
export type FolderUpdate = TablesUpdate<"folders">;

export type ResumeRow = Tables<"resumes">;
export type ResumeInsert = TablesInsert<"resumes">;
export type ResumeUpdate = TablesUpdate<"resumes">;

export type ResumeVersionRow = Tables<"resume_versions">;
export type ResumeVersionInsert = TablesInsert<"resume_versions">;

export type ResumeTemplateRow = Tables<"resume_templates">;
export type ExportRow = Tables<"exports">;
export type ExportInsert = TablesInsert<"exports">;
export type SubscriptionRow = Tables<"subscriptions">;
export type AiUsageRow = Tables<"ai_usage">;
export type AiUsageInsert = TablesInsert<"ai_usage">;
export type ActivityLogRow = Tables<"activity_logs">;
export type ActivityLogInsert = TablesInsert<"activity_logs">;

/**
 * The list columns actually needed to render a resume card.
 *
 * `content` is the entire document and can be tens of kilobytes; selecting it
 * for a grid of thirty cards is the difference between a fast dashboard and a
 * slow one. Kept here so the column list and the type cannot drift.
 */
export const RESUME_SUMMARY_COLUMNS =
  "id, title, template_id, folder_id, visibility, share_slug, tags, is_favorite, view_count, download_count, last_edited_at, deleted_at, created_at, updated_at" as const;

export type ResumeSummary = Pick<
  ResumeRow,
  | "id"
  | "title"
  | "template_id"
  | "folder_id"
  | "visibility"
  | "share_slug"
  | "tags"
  | "is_favorite"
  | "view_count"
  | "download_count"
  | "last_edited_at"
  | "deleted_at"
  | "created_at"
  | "updated_at"
>;

// ── Function helpers ──────────────────────────────────────────────────────────

type PublicFunctions = Database["public"]["Functions"];

export type FunctionName = keyof PublicFunctions;
export type FunctionArgs<T extends FunctionName> = PublicFunctions[T]["Args"];
export type FunctionReturns<T extends FunctionName> = PublicFunctions[T]["Returns"];

/** One row of `get_public_resume` — the only public read path into `resumes`. */
export type PublicResume = FunctionReturns<"get_public_resume">[number];

/**
 * Shape of `get_dashboard_stats()`.
 *
 * The function returns `jsonb`, which generates as `Json`, so this is a
 * hand-written contract rather than a derived type. It mirrors the
 * `jsonb_build_object` in the functions migration; the dashboard parses the
 * response with a Zod schema instead of casting, so a mismatch surfaces as a
 * validation error at the seam rather than `undefined` in the UI.
 */
export type DashboardStats = {
  resumeCount: number;
  trashedCount: number;
  downloadCount: number;
  aiCredits: number | null;
  lastEditedAt: string | null;
};

// ── Postgres error codes ──────────────────────────────────────────────────────
//
// The AI layer has to tell "out of credits" apart from "the database is down",
// and the only signal it gets is `PostgrestError.code`. These are the codes the
// migrations raise on purpose.

export const PG_ERROR = {
  /** `charge_ai_credits` when the balance is too low. */
  INSUFFICIENT_RESOURCES: "53000",
  /** A definer function called without a session. */
  INSUFFICIENT_PRIVILEGE: "42501",
  INVALID_PARAMETER_VALUE: "22023",
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  CHECK_VIOLATION: "23514",
} as const;

export type PgErrorCode = (typeof PG_ERROR)[keyof typeof PG_ERROR];
