"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Form, FormError, FormField, runAction, SubmitButton } from "@/components/shared/form";
import { Input } from "@/components/ui/input";

import { resendVerificationAction } from "../actions/auth-actions";
import { AUTH_BUTTON_SIZE, AUTH_FIELD_HEIGHT } from "../lib/field-styles";
import { resendVerificationSchema, type ResendVerificationInput } from "../schema/auth-schema";

/**
 * Re-sends the signup confirmation email.
 *
 * The address is prefilled from the query string that `signUpAction` wrote, so the
 * common case is one click. The field stays editable and visible rather than hidden
 * — someone who mistyped their address at signup has no other way out of this
 * screen, and a hidden input they cannot correct would strand them.
 */
export function ResendVerificationForm({ defaultEmail }: { defaultEmail?: string }) {
  const form = useForm<ResendVerificationInput>({
    resolver: zodResolver(resendVerificationSchema),
    defaultValues: { email: defaultEmail ?? "" },
    mode: "onBlur",
  });

  return (
    <Form
      form={form}
      onSubmit={(values) => runAction(form, () => resendVerificationAction(values))}
    >
      <FormField<ResendVerificationInput, "email"> name="email" label="Email">
        {(field) => (
          <Input
            {...field}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={AUTH_FIELD_HEIGHT}
          />
        )}
      </FormField>

      <FormError />

      <SubmitButton
        variant="outline"
        size={AUTH_BUTTON_SIZE}
        className="w-full"
        pendingLabel="Sending…"
      >
        Resend verification email
      </SubmitButton>
    </Form>
  );
}
