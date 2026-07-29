"use client";

/**
 * What a failed AI call looks like in the popover.
 *
 * The reason `AiActionFailure` carries a machine code rather than only a message is
 * this component: each code has a different next action, and offering the wrong one
 * is worse than offering none. "Out of credits" needs a link, not a retry button that
 * cannot succeed; "rate limited" needs the user to wait, and a retry button invites
 * them to burn the limit further; "not configured" is the operator's problem and
 * nothing the user does will help.
 *
 * `failure.error` is the only string rendered from the failure. It comes from a fixed
 * table server-side, never from the provider, so it cannot leak a key, a prompt, or
 * an upstream stack trace.
 */

import { TriangleAlert } from "lucide-react";

import { ButtonLink } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

import type { AiActionFailure } from "../lib/ai-action-result";

export interface AiFailureNoticeProps {
  failure: AiActionFailure;
  onRetry: () => void;
}

export function AiFailureNotice({ failure, onRetry }: AiFailureNoticeProps) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border border-destructive/25 bg-destructive/5 p-2.5"
    >
      <p className="flex gap-1.5 text-xs text-foreground">
        <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0 text-destructive" />
        <span>{failure.error}</span>
      </p>

      <FailureAction failure={failure} onRetry={onRetry} />
    </div>
  );
}

function FailureAction({ failure, onRetry }: AiFailureNoticeProps) {
  switch (failure.code) {
    case "insufficient_credits":
      return (
        <ButtonLink href={routes.settingsAi} variant="outline" size="xs">
          AI settings and credits
        </ButtonLink>
      );

    case "unauthenticated":
      return (
        <ButtonLink href={routes.login} variant="outline" size="xs">
          Sign in
        </ButtonLink>
      );

    // Both are waits, not retries: the limit is per window and the key is missing
    // from the deployment. A button here would only produce the same failure.
    case "rate_limited":
    case "not_configured":
      return null;

    default:
      return failure.retryable ? (
        <Button type="button" variant="outline" size="xs" onClick={onRetry}>
          Try again
        </Button>
      ) : null;
  }
}
