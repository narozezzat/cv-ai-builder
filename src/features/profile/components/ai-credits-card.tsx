import { SparklesIcon } from "lucide-react";

import { SectionCard } from "@/components/shared";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";

/**
 * The free grant, mirroring `profiles.ai_credits integer not null default 50` and
 * `subscriptions.monthly_ai_credits ... default 50`.
 *
 * Used only as the denominator of the bar. A paid plan will raise the real
 * allowance, at which point this becomes a lookup on the subscription row rather
 * than a constant — the balance itself already comes from the database, so nothing
 * downstream has to change.
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
  const percent = Math.round((remaining / allowance) * 100);

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
      {/*
        `Progress` associates its own label and value with the progressbar role, so
        the balance is announced as "Remaining, 32 of 50" rather than as a bare
        percentage. That is why the numbers live inside it and not beside it.
      */}
      <Progress value={percent}>
        <ProgressLabel>Remaining</ProgressLabel>
        {/*
          A render function, not text: Base UI's `Value` owns its own child and
          passes the formatted percentage in. Ignoring both arguments is the point —
          "32 / 50" is the number the user is actually deciding on, and the percent
          is only what drives the bar.
        */}
        <ProgressValue>{() => `${remaining} / ${allowance}`}</ProgressValue>
      </Progress>
    </SectionCard>
  );
}
