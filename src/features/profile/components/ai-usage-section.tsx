import { SkeletonCard } from "@/components/shared";
import { isAiConfigured } from "@/lib/env/server";

import { getMonthlyAiUsage, getProfile } from "../queries/profile-queries";
import { AiAvailabilityNotice } from "./ai-availability-notice";
import { AiCreditsCard } from "./ai-credits-card";
import { AiUsageLedger } from "./ai-usage-ledger";

/**
 * Balance, availability, and this month's spend — one boundary, one pair of reads.
 *
 * The three belong together: the balance is only meaningful next to what it was
 * spent on, and a zero balance is the reason the notice appears. Splitting them into
 * separate Suspense boundaries would let the card claim credits while the ledger
 * that explains them is still blank.
 *
 * `getProfile` is memoized per request, so the settings page's own profile read is
 * shared with this one.
 */
export async function AiUsageSection() {
  const [profile, usage] = await Promise.all([getProfile(), getMonthlyAiUsage(new Date())]);
  const credits = profile?.ai_credits ?? null;

  return (
    <>
      <AiAvailabilityNotice configured={isAiConfigured()} credits={credits} />
      <AiCreditsCard credits={credits} />
      <AiUsageLedger rows={usage.rows} truncated={usage.truncated} />
    </>
  );
}

/** Two cards, because that is the steady state: the balance and the ledger. */
export function AiUsageSkeleton() {
  return (
    <div role="status" aria-label="Loading your AI usage" className="space-y-4">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
