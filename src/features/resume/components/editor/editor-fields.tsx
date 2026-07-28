"use client";

/**
 * The editor's field primitives.
 *
 * Deliberately not React Hook Form. Every value here already lives in the resume
 * store, which owns the undo history and feeds autosave — putting a second copy in
 * a form state machine would mean two sources of truth, a sync layer between them,
 * and an undo stack that disagrees with what is on screen. So these are plain
 * controlled inputs: value in, change out, one store write per keystroke.
 *
 * Validation is deliberately thin here too. `maxLength` stops overlong input at the
 * source, dates report a malformed value inline, and everything else is checked by
 * `resumeDocumentSchema` at the save boundary — the same schema the server re-runs.
 * A field that blocks typing until it is valid is the wrong shape for a document
 * editor, where half-finished input is the normal state.
 */

import { useId, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { RESUME_DATE_PATTERN } from "@/types/resume";

export interface FieldShellProps {
  id: string;
  label: string;
  /** Helper text. Rendered before any error so the two never swap places. */
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Label, control, hint, error — wired together with the ids assistive tech needs.
 *
 * Exported for the rich-text field, which is not a plain input but has to look and
 * announce identically to the ones here.
 */
export function FieldShell({ id, label, hint, error, className, children }: FieldShellProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {/* `id` on the label as well as `htmlFor`: the rich-text field's control is a
          contenteditable div, which `htmlFor` cannot target, so it names itself with
          `aria-labelledby` pointing here. */}
      <Label id={`${id}-label`} htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>

      {children}

      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, hint?: string, error?: string): string | undefined {
  return (
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") ||
    undefined
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength: number;
  type?: "text" | "email" | "tel" | "url";
  autoComplete?: string;
  hint?: string;
  className?: string;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  type = "text",
  autoComplete,
  hint,
  className,
}: TextFieldProps) {
  const id = useId();

  return (
    <FieldShell id={id} label={label} hint={hint} className={className}>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        aria-describedby={describedBy(id, hint)}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}

/**
 * A partial date: `2021`, `2021-03`, or `2021-03-14`.
 *
 * Not `<input type="month">`. A native month picker cannot express "2019" on its
 * own, which is how most people write an education date, and it renders as a
 * different widget in every browser — including one that is unusable in Safari on
 * a Mac. Plain text plus an inline format check keeps what the user typed.
 */
interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  className?: string;
  disabled?: boolean;
}

export function DateField({ label, value, onChange, hint, className, disabled }: DateFieldProps) {
  const id = useId();
  const malformed = value.length > 0 && !RESUME_DATE_PATTERN.test(value);
  const error = malformed ? "Use a year, YYYY-MM, or YYYY-MM-DD." : undefined;

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <Input
        id={id}
        value={value}
        placeholder="2021-03"
        inputMode="numeric"
        maxLength={10}
        disabled={disabled}
        aria-invalid={malformed}
        aria-describedby={describedBy(id, hint, error)}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Shown for the empty value. Selecting it writes `""`. */
  placeholder: string;
  className?: string;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  className,
}: SelectFieldProps) {
  const id = useId();

  return (
    <FieldShell id={id} label={label} className={className}>
      <Select
        // Base UI treats `null` as "nothing selected"; the document spells that
        // `""`, so the two are translated here rather than in every caller.
        value={value === "" ? null : value}
        onValueChange={(next) => onChange(typeof next === "string" ? next : "")}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

interface SwitchFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  className?: string;
}

export function SwitchField({ label, checked, onChange, hint, className }: SwitchFieldProps) {
  const id = useId();

  return (
    <div className={cn("flex items-center justify-between gap-3 py-1", className)}>
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        {hint ? (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>

      <Switch
        id={id}
        checked={checked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onCheckedChange={onChange}
      />
    </div>
  );
}

/** Two columns from `sm` up. Most of the editor's fields pair naturally. */
export function FieldGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-3 sm:grid-cols-2", className)}>{children}</div>;
}
