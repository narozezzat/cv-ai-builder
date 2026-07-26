"use client";

import { useId, useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

import { AUTH_FIELD_HEIGHT } from "../lib/field-styles";

/**
 * A password input with a reveal toggle.
 *
 * Takes the same props as `<input>` so the object React Hook Form's `FormField`
 * hands to its render callback — `value`, `onChange`, `onBlur`, `name`, `id`,
 * `aria-describedby`, `aria-invalid`, `ref` — can be spread straight onto it.
 *
 * The toggle is `type="button"` (the `InputGroupButton` default) because a button
 * inside a form submits it otherwise, which would fire the action on every attempt
 * to check a typo. It stays in the tab order: hiding it from keyboard users is
 * exactly backwards, since they are the ones who cannot see what they typed.
 *
 * `aria-pressed` rather than a changing label alone, so the state is a property of
 * one control instead of two controls that happen to swap names.
 */
export function PasswordField({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const [revealed, setRevealed] = useState(false);
  const fallbackId = useId();
  const controlId = props.id ?? fallbackId;

  return (
    <InputGroup className={cn(AUTH_FIELD_HEIGHT, className)}>
      <InputGroupInput
        {...props}
        id={controlId}
        type={revealed ? "text" : "password"}
        // Password managers key off the field name and autocomplete hint; the
        // caller supplies `autoComplete` because only it knows whether this is a
        // login field ("current-password") or a new one ("new-password").
        spellCheck={false}
        autoCapitalize="off"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={revealed ? "Hide password" : "Show password"}
          aria-pressed={revealed}
          aria-controls={controlId}
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
