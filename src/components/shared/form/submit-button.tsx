"use client";

import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useFormState } from "react-hook-form";

import { Button } from "@/components/ui/button";

interface SubmitButtonProps extends Omit<ComponentProps<typeof Button>, "type"> {
  children: ReactNode;
  /** Replaces the label while submitting, e.g. "Creating account…". */
  pendingLabel?: string;
}

/**
 * Submit button that derives its pending state from the enclosing form instead
 * of a hand-managed boolean. Disabling during submit is the double-submit guard
 * for every form in the app — duplicate resumes and duplicate signups both
 * start as a second click on a button that looked idle.
 */
export function SubmitButton({ children, pendingLabel, disabled, ...props }: SubmitButtonProps) {
  const { isSubmitting } = useFormState();

  return (
    <Button type="submit" disabled={disabled || isSubmitting} {...props}>
      {/* `data-icon` drives the button's own icon spacing — see buttonVariants. */}
      {isSubmitting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
      {isSubmitting && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
