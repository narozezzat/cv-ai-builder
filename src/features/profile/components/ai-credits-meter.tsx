"use client";

import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";

interface AiCreditsMeterProps {
  remaining: number;
  allowance: number;
}

/**
 * The credit bar, split out from `AiCreditsCard` for one reason: Base UI types
 * `ProgressValue`'s children as `((formattedValue, value) => ReactNode) | null`,
 * with no text option, and a function cannot cross the RSC boundary — React fails
 * to serialize the payload and the route falls to its error boundary.
 *
 * So the callback needs a client module, but the card does not. Marking the card
 * itself `"use client"` would also turn the `FREE_MONTHLY_AI_CREDITS` it exports
 * into a client reference rather than a number, which is how that fix produced
 * "of NaN this month" on the dashboard.
 */
export function AiCreditsMeter({ remaining, allowance }: AiCreditsMeterProps) {
  const percent = Math.round((remaining / allowance) * 100);

  return (
    // `Progress` associates its own label and value with the progressbar role, so
    // the balance is announced as "Remaining, 32 / 50" rather than as a bare
    // percentage. That is why the numbers live inside it and not beside it.
    <Progress value={percent}>
      <ProgressLabel>Remaining</ProgressLabel>
      {/*
        Both arguments are ignored on purpose: "32 / 50" is the number the user is
        deciding on, and the percentage is only what drives the bar.
      */}
      <ProgressValue>{() => `${remaining} / ${allowance}`}</ProgressValue>
    </Progress>
  );
}
