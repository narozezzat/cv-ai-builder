"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Form, FormError, FormField, runAction, SubmitButton } from "@/components/shared/form";
import { Input } from "@/components/ui/input";

import { requestPasswordResetAction } from "../actions/auth-actions";
import { AUTH_BUTTON_SIZE, AUTH_FIELD_HEIGHT } from "../lib/field-styles";
import { forgotPasswordSchema, type ForgotPasswordInput } from "../schema/auth-schema";

/**
 * Requests a password-reset link.
 *
 * SECURITY: the action redirects to the same confirmation screen whether or not
 * the address has an account, so this form cannot be used to enumerate users. The
 * copy below therefore says "if an account exists" rather than "check your inbox"
 * — the UI must not imply a certainty the action deliberately withholds.
 */
export function ForgotPasswordForm({ defaultEmail }: { defaultEmail?: string }) {
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: defaultEmail ?? "" },
    mode: "onBlur",
  });

  return (
    <Form
      form={form}
      onSubmit={(values) => runAction(form, () => requestPasswordResetAction(values))}
    >
      <FormField<ForgotPasswordInput, "email">
        name="email"
        label="Email"
        description="We'll send a reset link if an account exists for this address."
      >
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
        variant="brand"
        size={AUTH_BUTTON_SIZE}
        className="w-full"
        pendingLabel="Sending link…"
      >
        Send reset link
      </SubmitButton>
    </Form>
  );
}
