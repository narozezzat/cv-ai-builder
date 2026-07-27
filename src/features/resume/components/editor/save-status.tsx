"use client";

/**
 * What the editor says about the state of the user's work.
 *
 * `role="status"` and `aria-live="polite"`: a save indicator that only changes
 * colour tells a screen reader user nothing, and this is the one piece of chrome
 * whose whole purpose is reassurance. Polite rather than assertive so it waits its
 * turn instead of interrupting whatever the user is typing.
 */

import { AlertTriangle, Check, CloudOff, Loader2, PencilLine } from "lucide-react";

import { cn } from "@/lib/utils";

import { useResumeStore, type SaveStatus } from "../../store/resume-store";

const PRESENTATION: Record<SaveStatus, { label: string; icon: typeof Check; className: string }> = {
  idle: { label: "Saved", icon: Check, className: "text-muted-foreground" },
  dirty: { label: "Unsaved changes", icon: PencilLine, className: "text-muted-foreground" },
  saving: { label: "Saving…", icon: Loader2, className: "text-muted-foreground" },
  saved: { label: "Saved", icon: Check, className: "text-emerald-600 dark:text-emerald-400" },
  error: { label: "Not saved", icon: CloudOff, className: "text-destructive" },
  conflict: { label: "Newer version exists", icon: AlertTriangle, className: "text-destructive" },
};

export function SaveStatusIndicator({ className }: { className?: string }) {
  const status = useResumeStore((state) => state.status);

  const { label, icon: Icon, className: tone } = PRESENTATION[status];

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-1.5 text-xs", tone, className)}
    >
      <Icon aria-hidden className={cn("size-3.5", status === "saving" && "animate-spin")} />
      {/*
        Hidden below `sm` visually but never from assistive tech: the icon carries
        the meaning on a phone, and an icon alone has no accessible name.
      */}
      <span className="sr-only sm:not-sr-only">{label}</span>
    </p>
  );
}
