/**
 * Reads for the account surface: the profile row, the activity feed, dashboard stats,
 * the AI usage ledger.
 *
 * All of them go through the cookie-bound client, so RLS is what scopes them — none
 * of these queries carries a `user_id` filter of its own except where it makes the
 * intent legible. That is deliberate: a filter in TypeScript is a convenience, and
 * relying on it would mean a forgotten `.eq()` becomes a data leak. `auth.uid()`
 * in the policy is the guarantee.
 */

import "server-only";

import { cache } from "react";
import { z } from "zod";

import { createSupabaseServerClient, requireUser } from "@/services/supabase/server";
import {
  AI_USAGE_LEDGER_COLUMNS,
  type ActivityLogRow,
  type AiUsageEntry,
  type DashboardStats,
  type ProfileRow,
} from "@/types/db";

import { startOfMonthIso } from "../lib/ai-usage";

/** Explicit rather than `*`: adding a column should not silently widen a payload. */
const PROFILE_COLUMNS =
  "id, email, full_name, headline, avatar_url, role, ai_credits, locale, theme, ai_preferences, notification_preferences, onboarded_at, created_at, updated_at";

/**
 * The signed-in user's profile row, or `null` if it is somehow absent.
 *
 * Absent should be impossible: `handle_new_user` creates the row in the same
 * transaction as the `auth.users` insert. It is still modelled as nullable because
 * the alternative is a settings page that throws for an account in that state,
 * which is the worst possible moment to lose the ability to look at your account.
 * Callers fall back to the session's own email.
 *
 * Memoized per request: the app shell needs it for the header, and the dashboard's
 * greeting and credits card each suspend on it independently. Without `cache()` that
 * is three identical round-trips for one render, and the count grows with every
 * streamed widget that wants a profile field.
 */
export const getProfile = cache(async (): Promise<ProfileRow | null> => {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[profile] load failed", { code: error.code, message: error.message });

    return null;
  }

  return data;
});

/**
 * Most recent account activity, newest first.
 *
 * Bounded by `limit` at the database rather than trimmed in JS — the table grows
 * without ceiling and the feed only ever shows a handful.
 */
export async function getRecentActivity(limit = 8): Promise<ActivityLogRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("activity_logs")
    .select(
      "id, action, entity_type, entity_id, metadata, created_at, ip_address, user_agent, user_id",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[profile] activity load failed", { code: error.code, message: error.message });

    return [];
  }

  return data ?? [];
}

/**
 * Ledger rows for the current calendar month, newest first.
 *
 * Bounded twice over. `since` keeps the scan on the `(user_id, created_at desc)`
 * index, and `limit` is a backstop: every row charges at least one credit and guard
 * rejections never write a row, so a month cannot realistically produce more than
 * the allowance. `truncated` exists so a month that somehow exceeds the cap says so
 * in the UI rather than quietly reporting a total that is too low.
 */
export async function getMonthlyAiUsage(
  now: Date,
  limit = 200,
): Promise<{ rows: AiUsageEntry[]; truncated: boolean }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("ai_usage")
    .select(AI_USAGE_LEDGER_COLUMNS)
    .gte("created_at", startOfMonthIso(now))
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[profile] ai usage load failed", { code: error.code, message: error.message });

    return { rows: [], truncated: false };
  }

  const rows = data ?? [];

  return { rows, truncated: rows.length === limit };
}

/**
 * Runtime contract for `get_dashboard_stats()`'s jsonb.
 *
 * Kept next to its only caller and typed `satisfies z.ZodType<DashboardStats>`, so
 * the TypeScript contract in `types/db.ts` and the parser here cannot drift apart
 * without a compile error.
 */
const dashboardStatsSchema = z.object({
  resumeCount: z.number().int().nonnegative(),
  trashedCount: z.number().int().nonnegative(),
  downloadCount: z.number().int().nonnegative(),
  aiCredits: z.number().int().nullable(),
  lastEditedAt: z.string().nullable(),
}) satisfies z.ZodType<DashboardStats>;

/**
 * Dashboard counters in one round-trip.
 *
 * `get_dashboard_stats` is a plain `stable sql` function — not SECURITY DEFINER —
 * so its aggregates run under the caller's policies and can only see the caller's
 * rows. It returns `jsonb`, which arrives here as `unknown` shape, so it is parsed
 * rather than cast: a function signature that drifts should fail loudly in one
 * place instead of producing `NaN` in a stat card.
 */
export async function getDashboardStats(): Promise<DashboardStats | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_dashboard_stats");

  if (error) {
    console.error("[profile] dashboard stats failed", { code: error.code, message: error.message });

    return null;
  }

  const parsed = dashboardStatsSchema.safeParse(data);

  if (!parsed.success) {
    console.error(
      "[profile] dashboard stats did not match the expected shape",
      parsed.error.issues,
    );

    return null;
  }

  return parsed.data;
}
