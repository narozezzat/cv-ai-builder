import { SkeletonCard } from "@/components/shared";

import { getProfile } from "../queries/profile-queries";
import { AiCreditsCard } from "./ai-credits-card";

/**
 * The credit balance, streamed alongside the activity panel.
 *
 * Shares `getProfile`'s memoized result with the greeting and the app header, so
 * splitting this out costs a boundary and no extra query.
 */
export async function AiCreditsSection() {
  const profile = await getProfile();

  return <AiCreditsCard credits={profile?.ai_credits ?? null} />;
}

/** `SectionCard`-shaped, because that is what `AiCreditsCard` renders. */
export function AiCreditsSkeleton() {
  return (
    <div role="status" aria-label="Loading your AI credits">
      <SkeletonCard />
    </div>
  );
}
