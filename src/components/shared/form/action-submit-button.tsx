"use client";

import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

interface ActionSubmitButtonProps extends Omit<ComponentProps<typeof Button>, "type"> {
  children: ReactNode;
  /** Replaces the label while the action is in flight, e.g. "Signing out…". */
  pendingLabel?: string;
}

/**
 * Submit button for a plain `<form action={serverAction}>` — the no-JavaScript-
 * required counterpart to `SubmitButton`, which derives its state from React Hook
 * Form and therefore only works inside `<Form>`.
 *
 * `useFormStatus` reads the pending state of the enclosing form, so this is the one
 * piece of the tree that has to be a Client Component. Everything around it —
 * including the `<form>` itself — can stay on the server, and the form still submits
 * if the JavaScript never arrives.
 */
export function ActionSubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: ActionSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={disabled || pending} {...props}>
      {pending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
