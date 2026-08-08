"use client";

import { useState, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import { unstable_rethrow } from "next/navigation";

import { GitHubIcon, GoogleIcon } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { signInWithOAuthAction } from "../actions/auth-actions";
import { AUTH_BUTTON_SIZE } from "../lib/field-styles";
import { OAUTH_PROVIDERS, type OAuthProvider } from "../schema/auth-schema";

type ProviderMeta = { label: string; Icon: ComponentType<React.ComponentProps<"svg">> };

const PROVIDER_META: Record<OAuthProvider, ProviderMeta> = {
  google: { label: "Google", Icon: GoogleIcon },
  github: { label: "GitHub", Icon: GitHubIcon },
};

/**
 * Social sign-in buttons.
 *
 * `providers` is computed on the server from `isOAuthConfigured`, so a provider
 * without credentials never renders a button that leads to an error page. An empty
 * list renders nothing at all — including the divider, which is why the divider
 * lives in here rather than in the pages.
 *
 * Every button posts to a Server Action instead of calling `signInWithOAuth` in
 * the browser. That is what keeps the PKCE verifier in an httpOnly cookie; see the
 * note in `auth-actions.ts`.
 */
export function OAuthButtons({
  providers,
  next,
  className,
}: {
  providers: readonly OAuthProvider[];
  next?: string;
  className?: string;
}) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (providers.length === 0) {
    return null;
  }

  async function start(provider: OAuthProvider) {
    setPending(provider);
    setError(null);

    try {
      // On success the action redirects to the provider, so this resolves with
      // nothing and `pending` stays set until the page unloads — which is the state
      // we want, since the user is on their way out.
      const result = await signInWithOAuthAction(provider, next);

      if (result?.error) {
        setError(result.error);
        setPending(null);
      }
    } catch (error) {
      // Only a *cross-origin* redirect resolves like that. Next streams flight data
      // for an app-relative one and rejects the action promise with `NEXT_REDIRECT`
      // instead, so a blanket `catch` here would report the router's success signal
      // as a failed sign-in the day this action redirects anywhere in-app — the bug
      // `runAction` already shipped once. Hand framework signals back before
      // deciding anything.
      unstable_rethrow(error);

      setError("Could not reach the sign-in service. Check your connection.");
      setPending(null);
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className={cn("grid gap-2", providers.length > 1 && "sm:grid-cols-2")}>
        {/* Iterating the canonical order keeps button positions stable no matter
            which providers happen to be configured. */}
        {OAUTH_PROVIDERS.filter((provider) => providers.includes(provider)).map((provider) => {
          const { label, Icon } = PROVIDER_META[provider];
          const isPending = pending === provider;

          return (
            <Button
              key={provider}
              type="button"
              variant="outline"
              size={AUTH_BUTTON_SIZE}
              className="w-full"
              disabled={pending !== null}
              onClick={() => void start(provider)}
            >
              {isPending ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Icon data-icon="inline-start" className="size-4" />
              )}
              Continue with {label}
            </Button>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
