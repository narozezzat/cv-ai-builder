/**
 * Rate-limit enforcement, shared by every feature that has an abusable endpoint.
 *
 * This lives in `services` rather than inside a feature because more than one
 * feature needs it: auth throttles credential attempts, profile throttles avatar
 * uploads, and the AI surface will throttle generation. The buckets themselves
 * (action name, window, ceiling) stay with the feature that owns the endpoint —
 * only the enforcement decision is shared.
 *
 * SECURITY: `subject` must always be derived server-side, via `rateLimitSubject`
 * in `src/lib/request.ts`. A caller-supplied subject lets an attacker either burn
 * someone else's quota or mint themselves a fresh one per request.
 */

import "server-only";

import { isServiceRoleConfigured, serverEnv } from "@/lib/env/server";
import { consumeRateLimit, type RateLimitRule } from "./supabase/admin";

export type { RateLimitRule } from "./supabase/admin";

/**
 * Consumes one unit of allowance, returning false when the caller is over limit.
 *
 * The `isServiceRoleConfigured` branch is the one judgment call here.
 * `consumeRateLimit` fails closed, which is correct for a database that is
 * struggling but wrong for a checkout with no `SUPABASE_SERVICE_ROLE_KEY`: there,
 * every single login would be refused with a message about too many attempts, and
 * the actual problem — a missing environment variable — would be invisible. So
 * development logs loudly and proceeds; production still fails closed, because a
 * production deployment missing that key is a misconfiguration that must not
 * quietly ship an unlimited endpoint.
 */
export async function enforceRateLimit(
  rule: RateLimitRule,
  subject: string,
): Promise<{ allowed: boolean }> {
  if (!isServiceRoleConfigured()) {
    if (serverEnv.NODE_ENV === "production") {
      console.error(
        "[rate-limit] SUPABASE_SERVICE_ROLE_KEY is missing, so rate limiting is unavailable. Denying.",
        { action: rule.action },
      );

      return { allowed: false };
    }

    console.warn(
      `[rate-limit] SUPABASE_SERVICE_ROLE_KEY is missing — skipping the ${rule.action} limit. Set it in .env.local.`,
    );

    return { allowed: true };
  }

  return { allowed: await consumeRateLimit(subject, rule) };
}

/** Message shown when a limit is hit. Vague on purpose: no countdown to game. */
export const RATE_LIMITED_MESSAGE = "Too many attempts. Wait a few minutes and try again.";
