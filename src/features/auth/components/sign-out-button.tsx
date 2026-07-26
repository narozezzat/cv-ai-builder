import { LogOutIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { ActionSubmitButton } from "@/components/shared/form";
import type { Button } from "@/components/ui/button";

import { signOutAction } from "../actions/auth-actions";

/**
 * Signs the current user out.
 *
 * A `<form>` posting to a Server Action rather than an `onClick` handler, for three
 * reasons: it is a state-changing request and so belongs in a POST, the enclosing
 * component stays on the server, and it still works before — or without — hydration.
 * Signing out is exactly the action a user reaches for when a page is misbehaving.
 *
 * No confirmation dialog. Sign-out is trivially reversible by signing back in, and
 * a prompt on every use trains people to dismiss prompts.
 */
export function SignOutButton({
  variant = "ghost",
  size,
  className,
  label = "Sign out",
  showIcon = true,
}: {
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
  label?: string;
  showIcon?: boolean;
}) {
  return (
    <form action={signOutAction} className="contents">
      <ActionSubmitButton
        variant={variant}
        size={size}
        className={className}
        pendingLabel="Signing out…"
      >
        {showIcon ? <LogOutIcon data-icon="inline-start" /> : null}
        {label}
      </ActionSubmitButton>
    </form>
  );
}
