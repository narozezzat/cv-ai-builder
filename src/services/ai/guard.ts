/**
 * Everything that must be true before a model is allowed to run.
 *
 * The order is the design, not an accident:
 *
 *   1. authenticated  — an anonymous caller must never reach a paid provider.
 *   2. configured     — fail before charging, so a missing key costs nobody credits.
 *   3. rate limited   — cheap, and it is the bucket that stops a retry loop.
 *   4. credits        — last, because it is the only step that mutates state, and a
 *                      debit followed by a rejection is the one failure that costs
 *                      the user something. There is no refund path (see credits.ts).
 *
 * SECURITY: this is the single choke point for the AI surface. A capability that
 * calls a provider without going through `runAiTask` — which calls this — is
 * unmetered and unthrottled, so new capabilities go through the engine, always.
 */

import "server-only";

import { isAiConfigured } from "@/lib/env/server";
import { rateLimitSubject } from "@/lib/request";
import { enforceRateLimit } from "@/services/rate-limit";
import { getCurrentUser } from "@/services/supabase/server";
import { AI_CAPABILITY_CONFIG, AI_RATE_LIMIT_RULES, type AiCapability } from "./capabilities";
import { chargeCredits } from "./credits";
import { AiError } from "./errors";

export type AiGuardResult = {
  userId: string;
  /** Charged amount, so the ledger records what was actually taken. */
  creditsCharged: number;
  /** Balance after the debit, so the UI can update the meter without a refetch. */
  creditsRemaining: number;
};

export async function guardAiRequest(capability: AiCapability): Promise<AiGuardResult> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AiError("unauthenticated");
  }

  if (!isAiConfigured()) {
    throw new AiError("not_configured");
  }

  // Every rule, always, keyed to the user rather than the capability — see the
  // comment on AI_RATE_LIMITS for why per-capability buckets are no bucket at all.
  for (const rule of AI_RATE_LIMIT_RULES) {
    const limit = await enforceRateLimit(rule, rateLimitSubject("ai-user", user.id));

    if (!limit.allowed) {
      // A limiter that cannot reach its database denies too, but the caller is not
      // over anything — telling them they made too many requests is a lie, and
      // `rate_limited` is not retryable so the UI would hide the retry button on
      // the one failure retrying actually fixes.
      throw new AiError(limit.reason === "limited" ? "rate_limited" : "provider_unavailable");
    }
  }

  const creditsCharged = AI_CAPABILITY_CONFIG[capability].credits;
  const creditsRemaining = await chargeCredits(creditsCharged);

  return { userId: user.id, creditsCharged, creditsRemaining };
}
