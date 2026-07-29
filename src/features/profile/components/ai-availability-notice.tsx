import { InfoIcon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export interface AiAvailabilityNoticeProps {
  /** `isAiConfigured()` on the server — a provider key is present. */
  configured: boolean;
  /** `null` when the profile row could not be read; treated as unknown, not zero. */
  credits: number | null;
}

/**
 * States the whole app cannot generate in, said once and up front.
 *
 * Every AI action already fails gracefully at its own call site through
 * `AiFailureNotice`, but that only tells the user after they have tried. Both of
 * the conditions here are knowable before the click, and both are permanent until
 * something changes — the key, or the month — so they belong on the settings page
 * rather than being rediscovered per field.
 *
 * Renders nothing when AI works. A notice that is always on screen is chrome.
 */
export function AiAvailabilityNotice({ configured, credits }: AiAvailabilityNoticeProps) {
  if (!configured) {
    return (
      <Alert>
        <InfoIcon aria-hidden />
        <AlertTitle>AI features are switched off</AlertTitle>
        <AlertDescription>
          No AI provider is configured for this deployment, so generation, rewriting, and job
          matching are unavailable. Everything else — editing, templates, and export — works
          normally, and no credits are spent while this is the case.
        </AlertDescription>
      </Alert>
    );
  }

  if (credits === 0) {
    return (
      <Alert>
        <TriangleAlertIcon aria-hidden />
        <AlertTitle>You&rsquo;re out of AI credits</AlertTitle>
        <AlertDescription>
          Credits reset at the start of each month. Until then, AI actions will decline instead of
          running — editing, templates, and export are unaffected.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
