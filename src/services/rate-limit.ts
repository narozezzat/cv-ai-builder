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

/** Why a request was refused. Both deny; only one of them is the caller's fault. */
export type RateLimitDenial = "limited" | "unavailable";

/**
 * The outcome of a limit check.
 *
 * A discriminated union rather than `{ allowed, reason }` so `reason` cannot be
 * read on a request that was allowed, and cannot be forgotten on one that wasn't.
 */
export type RateLimitResult = { allowed: true } | { allowed: false; reason: RateLimitDenial };

/**
 * Consumes one unit of allowance.
 *
 * The `isServiceRoleConfigured` branch is the one judgment call here.
 * `consumeRateLimit` fails closed, which is correct for a database that is
 * struggling but wrong for a checkout with no `SUPABASE_SERVICE_ROLE_KEY`: there,
 * every single login would be refused, and the actual problem — a missing
 * environment variable — would be invisible. So development logs loudly and
 * proceeds; production still fails closed, because a production deployment
 * missing that key is a misconfiguration that must not quietly ship an unlimited
 * endpoint. It fails closed as `unavailable`, though: nobody is over a limit that
 * was never checked.
 */
export async function enforceRateLimit(
  rule: RateLimitRule,
  subject: string,
): Promise<RateLimitResult> {
  if (!isServiceRoleConfigured()) {
    if (serverEnv.NODE_ENV === "production") {
      console.error(
        "[rate-limit] SUPABASE_SERVICE_ROLE_KEY is missing, so rate limiting is unavailable. Denying.",
        { action: rule.action },
      );

      return { allowed: false, reason: "unavailable" };
    }

    console.warn(
      `[rate-limit] SUPABASE_SERVICE_ROLE_KEY is missing — skipping the ${rule.action} limit. Set it in .env.local.`,
    );

    return { allowed: true };
  }

  const verdict = await consumeRateLimit(subject, rule);

  return verdict === "allowed" ? { allowed: true } : { allowed: false, reason: verdict };
}

/** Message shown when a limit is hit. Vague on purpose: no countdown to game. */
export const RATE_LIMITED_MESSAGE = "Too many attempts. Wait a few minutes and try again.";

/**
 * Message shown when the limiter could not reach the database.
 *
 * Deliberately not the one above. The limiter denies either way, but telling
 * someone to wait out an outage sends them off to retry a request that will keep
 * failing, and hides a service problem behind what reads like a user problem —
 * which is exactly how an unreachable Supabase project once presented itself as
 * every user being simultaneously over their limit.
 */
export const RATE_LIMIT_UNAVAILABLE_MESSAGE =
  "Something went wrong on our end. Try again in a moment.";

/** The message that matches the denial, so no caller has to guess. */
export function rateLimitMessage(reason: RateLimitDenial): string {
  return reason === "limited" ? RATE_LIMITED_MESSAGE : RATE_LIMIT_UNAVAILABLE_MESSAGE;
}
