/**
 * Service-role Supabase client and the writes only it may perform.
 *
 * SECURITY: this client bypasses RLS completely. Every query made through it is
 * unauthorized by the database, so authorization has to happen in TypeScript
 * immediately above it. Three rules, which the exported functions below follow:
 *
 * 1. Never take a user id from a request body, query string, or form field. Every
 *    function here takes `userId` and every caller must pass the id from a
 *    session already verified with `getCurrentUser()` / `requireUser()`.
 * 2. Never hand this client to feature code that could pass a filter through from
 *    the client. The exported surface is a small set of specific writes, not a
 *    general-purpose escape hatch — `getSupabaseAdminClient` exists for the
 *    export pipeline's storage uploads and nothing else yet.
 * 3. `import "server-only"`, so importing it from a client component is a build
 *    error rather than a leaked key.
 *
 * This module is the designated writer for `activity_logs`, `ai_usage`, and
 * `exports`, all of which have `insert, update, delete` revoked from `anon` and
 * `authenticated` in the RLS migration. It is also the only caller of
 * `check_rate_limit`, which is granted to `service_role` alone because its
 * `subject` argument is caller-supplied.
 */

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireServerEnv } from "@/lib/env/server";
import { publicEnv } from "@/lib/env/public";
import type { ActivityLogInsert, AiUsageInsert } from "@/types/db";
import type { Database } from "@/types/database";

export type SupabaseAdminClient = SupabaseClient<Database>;

let cached: SupabaseAdminClient | null = null;

export function getSupabaseAdminClient(): SupabaseAdminClient {
  if (cached) {
    return cached;
  }

  // Throws with a named variable if the key is absent. Deliberately at call time
  // rather than module load: `SUPABASE_SERVICE_ROLE_KEY` is optional in
  // `serverEnv` so that a contributor can run the app without it, and only the
  // features that genuinely need it fail.
  const serviceRoleKey = requireServerEnv("SUPABASE_SERVICE_ROLE_KEY");

  cached = createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      // No cookie, no refresh, no storage. This client has no user and must never
      // pick one up from an ambient session — `auth.uid()` is null under the
      // service role, which is exactly the point.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cached;
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export type LogActivityInput = {
  /** From a verified session. Never from request input. */
  userId: string;
  action: ActivityLogInsert["action"];
  entityType?: ActivityLogInsert["entity_type"];
  entityId?: string | null;
  metadata?: ActivityLogInsert["metadata"];
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Appends one audit entry.
 *
 * Never throws and never returns a failure the caller has to handle: an audit
 * write failing must not turn a successful resume save into an error the user
 * sees. It is logged to the server console so the loss is visible in operations
 * rather than silent.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const { error } = await getSupabaseAdminClient()
      .from("activity_logs")
      .insert({
        user_id: input.userId,
        action: input.action,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        metadata: input.metadata ?? {},
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
      });

    if (error) {
      console.error("[audit] failed to write activity log", {
        action: input.action,
        code: error.code,
        message: error.message,
      });
    }
  } catch (cause) {
    console.error("[audit] activity log threw", cause);
  }
}

// ── AI usage ledger ───────────────────────────────────────────────────────────

export type RecordAiUsageInput = {
  /** From a verified session. Never from request input. */
  userId: string;
  resumeId?: string | null;
  capability: string;
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  creditsCharged?: number;
  latencyMs?: number | null;
  success?: boolean;
  errorCode?: string | null;
};

/**
 * Records one model call.
 *
 * This ledger is what the provider invoice gets reconciled against, so it is
 * written for failed calls too — a request that burned prompt tokens and then
 * errored still cost money. Like `logActivity`, it never throws: losing a ledger
 * row is bad, failing the user's AI action because the ledger insert failed is
 * worse.
 *
 * `total_tokens` is a GENERATED ALWAYS column and is not written here.
 */
export async function recordAiUsage(input: RecordAiUsageInput): Promise<void> {
  const row: AiUsageInsert = {
    user_id: input.userId,
    resume_id: input.resumeId ?? null,
    capability: input.capability,
    provider: input.provider,
    model: input.model,
    prompt_tokens: input.promptTokens ?? 0,
    completion_tokens: input.completionTokens ?? 0,
    cost_usd: input.costUsd ?? 0,
    credits_charged: input.creditsCharged ?? 0,
    latency_ms: input.latencyMs ?? null,
    success: input.success ?? true,
    error_code: input.errorCode ?? null,
  };

  try {
    const { error } = await getSupabaseAdminClient().from("ai_usage").insert(row);

    if (error) {
      console.error("[ai] failed to record usage", {
        capability: input.capability,
        code: error.code,
        message: error.message,
      });
    }
  } catch (cause) {
    console.error("[ai] usage insert threw", cause);
  }
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

export type RateLimitRule = {
  action: string;
  /** Postgres interval literal, e.g. `'1 minute'`, `'24 hours'`. */
  window: string;
  max: number;
};

/**
 * The three answers a limit check can give.
 *
 * `unavailable` is distinct from `limited` even though both deny the request,
 * because only one of them is the caller's doing. Collapsing them into a boolean
 * makes a database outage indistinguishable from normal throttling, and every
 * surface then tells the user to wait a few minutes for a problem waiting cannot
 * solve.
 */
export type RateLimitVerdict = "allowed" | "limited" | "unavailable";

/**
 * Consumes one unit of a subject's allowance.
 *
 * Returns a verdict rather than throwing, so callers branch rather than catch.
 * `subject` must be derived server-side — a verified user id, or a hashed IP for
 * unauthenticated actions. Passing anything client-supplied here would let a
 * caller burn another user's quota, which is why the underlying function is
 * granted to `service_role` only.
 *
 * Fails closed. If the check itself errors the request is still denied — a rate
 * limiter that opens under database trouble is a rate limiter that is absent
 * exactly when something is going wrong — but it is denied as `unavailable`.
 */
export async function consumeRateLimit(
  subject: string,
  rule: RateLimitRule,
): Promise<RateLimitVerdict> {
  try {
    const { data, error } = await getSupabaseAdminClient().rpc("check_rate_limit", {
      p_subject: subject,
      p_action: rule.action,
      p_window: rule.window,
      p_max_count: rule.max,
    });

    if (error) {
      console.error("[rate-limit] check failed, denying", {
        action: rule.action,
        code: error.code,
        message: error.message,
      });
      return "unavailable";
    }

    return data === true ? "allowed" : "limited";
  } catch (cause) {
    console.error("[rate-limit] check threw, denying", cause);
    return "unavailable";
  }
}
