import { SparklesIcon } from "lucide-react";

import { SectionCard } from "@/components/shared";

import { AiCreditsMeter } from "./ai-credits-meter";

/**
 * The free grant, mirroring `profiles.ai_credits integer not null default 50` and
 * `subscriptions.monthly_ai_credits ... default 50`.
 *
 * Used only as the denominator of the bar. A paid plan will raise the real
 * allowance, at which point this becomes a lookup on the subscription row rather
 * than a constant — the balance itself already comes from the database, so nothing
 * downstream has to change.
 *
 * Exported from a Server Component on purpose. `"use client"` here would turn this
 * into a client reference instead of the number `50`, and `StatCards` reads it on
 * the server.
 */
export const FREE_MONTHLY_AI_CREDITS = 50;

interface AiCreditsCardProps {
  /** `null` when the profile row could not be read; see `getProfile`. */
  credits: number | null;
}

/**
 * Credit balance, shown before the user spends rather than after.
 *
 * Every AI action is metered, and a generation that fails on an empty balance is
 * far more annoying than one the user could see coming. The bar depletes rather
 * than fills for the same reason: the interesting number is what's left.
 */
export function AiCreditsCard({ credits }: AiCreditsCardProps) {
  const remaining = Math.max(0, credits ?? 0);
  // A balance above the free grant (top-up, promo) must not render a bar past 100%.
  const allowance = Math.max(FREE_MONTHLY_AI_CREDITS, remaining);

  return (
    <SectionCard
      icon={SparklesIcon}
      title="AI credits"
      description={
        remaining === 0
          ? "You're out of credits. Editing and exporting still work."
          : "Spent on generation, rewriting, and scoring."
      }
    >
      <AiCreditsMeter remaining={remaining} allowance={allowance} />
    </SectionCard>
  );
}
