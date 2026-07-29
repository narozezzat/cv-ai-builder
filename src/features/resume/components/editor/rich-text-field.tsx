"use client";

/**
 * The rich-text field, as the section forms see it.
 *
 * Two jobs the editor leaf deliberately does not do. First, it loads TipTap through
 * `next/dynamic` with `ssr: false`: ProseMirror plus the extension set is the single
 * biggest chunk in the editor, and a resume has up to eight of these fields, so it
 * stays out of the initial bundle and out of the server render. Second, it connects
 * `Mod-z` to the resume store, keeping the editor itself store-agnostic — the AI
 * suggestion popover reuses it against a scratch value that has no history.
 */

import dynamic from "next/dynamic";
import { useId, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { useResumeStore } from "../../store/resume-store";
import { FieldShell, describedBy } from "./editor-fields";

const RichTextEditor = dynamic(
  () => import("./rich-text-editor").then((module) => module.RichTextEditor),
  {
    ssr: false,
    // Same height as the mounted editor's toolbar plus `min-h-24` body, so the
    // panel does not jump when the chunk lands.
    loading: () => <Skeleton className="h-34 w-full rounded-md" />,
  },
);

interface RichTextFieldProps {
  label: string;
  /** Stored HTML. `""` for an untouched field. */
  value: string;
  onChange: (html: string) => void;
  /** The field's Zod bound, measured in HTML characters. */
  maxLength: number;
  placeholder?: string;
  hint?: string;
  /** Rendered beside the label — the AI suggestion trigger for this field. */
  action?: ReactNode;
  className?: string;
}

export function RichTextField({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  hint,
  action,
  className,
}: RichTextFieldProps) {
  const id = useId();
  const undo = useResumeStore((state) => state.undo);
  const redo = useResumeStore((state) => state.redo);

  // Counted the way the editor enforces it and the way Zod validates it — on the
  // HTML — but reported against the prose the user can see, because "1,847 of 2,000"
  // is meaningless when 300 of those characters are `<strong>` tags. Only shown near
  // the ceiling: a permanent counter on every description reads as a constraint the
  // user is being asked to work around.
  const remainingHtml = maxLength - value.length;
  const shownHint =
    remainingHtml <= 200 ? `Formatting included, about ${remainingHtml} characters left` : hint;

  return (
    <FieldShell id={id} label={label} hint={shownHint} action={action} className={className}>
      <RichTextEditor
        id={id}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        placeholder={placeholder}
        ariaLabelledBy={`${id}-label`}
        ariaDescribedBy={describedBy(id, shownHint)}
        onUndo={undo}
        onRedo={redo}
      />
    </FieldShell>
  );
}
