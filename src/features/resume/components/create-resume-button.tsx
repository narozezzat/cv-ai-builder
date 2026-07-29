"use client";

import { Loader2, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { isActionFailure } from "@/components/shared/form";
import { Button } from "@/components/ui/button";

import { createResumeAction } from "../actions/resume-actions";

interface CreateResumeButtonProps {
  /** Files the new resume into the folder the user is currently viewing. */
  folderId?: string | null;
  /**
   * Starts the resume on a specific template — this is what "Use this template" in the
   * gallery does. Omitted everywhere else, so the action applies the default.
   */
  templateId?: string;
  label?: string;
  variant?: "brand" | "outline" | "secondary";
  size?: "default" | "sm";
  className?: string;
}

/**
 * The only way a resume gets created.
 *
 * `createResumeAction` redirects into the builder on success, so there is no
 * success branch to handle here — the pending state is cleared only on failure,
 * because on success the button is unmounted by the navigation. Clearing it before
 * the redirect commits would flash an idle button on a page that is leaving.
 */
export function CreateResumeButton({
  folderId = null,
  templateId,
  label = "New resume",
  variant = "brand",
  size = "default",
  className,
}: CreateResumeButtonProps) {
  const [pending, startTransition] = useTransition();
  // Survives past the transition: the redirect is still in flight after the
  // action resolves, and re-enabling the button in that window invites a second
  // resume being created by an impatient double-click.
  const [submitted, setSubmitted] = useState(false);

  const busy = pending || submitted;

  function handleClick() {
    if (busy) return;

    setSubmitted(true);

    startTransition(async () => {
      // `templateId` is omitted rather than sent as `undefined`-shaped noise so the
      // schema's `.default()` is what fills it in.
      const result = await createResumeAction(templateId ? { folderId, templateId } : { folderId });

      if (isActionFailure(result)) {
        toast.error(result.error);
        setSubmitted(false);
      }
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={busy}
      onClick={handleClick}
      className={className}
    >
      {busy ? (
        <Loader2 data-icon="inline-start" className="animate-spin" />
      ) : (
        <Plus data-icon="inline-start" />
      )}
      {busy ? "Creating…" : label}
    </Button>
  );
}
