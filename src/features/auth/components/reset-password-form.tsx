"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { Form, FormError, FormField, runAction, SubmitButton } from "@/components/shared/form";

import { resetPasswordAction } from "../actions/auth-actions";
import { AUTH_BUTTON_SIZE } from "../lib/field-styles";
import { resetPasswordSchema, type ResetPasswordInput } from "../schema/auth-schema";
import { PasswordField } from "./password-field";
import { PasswordStrengthMeter } from "./password-strength-meter";

/**
 * Sets a new password for the session the recovery link established.
 *
 * There is no "current password" field, and there should not be: the caller proved
 * possession of the mailbox, which is the whole point of a recovery flow. The
 * session backing this form is the one minted by `/auth/callback` from the
 * recovery token, so `updateUser` has an identity to act on.
 */
export function ResetPasswordForm() {
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onBlur",
  });

  const password = useWatch({ control: form.control, name: "password" });

  return (
    <Form form={form} onSubmit={(values) => runAction(form, () => resetPasswordAction(values))}>
      <div className="space-y-3">
        <FormField<ResetPasswordInput, "password"> name="password" label="New password">
          {(field) => <PasswordField {...field} autoComplete="new-password" />}
        </FormField>

        {password ? <PasswordStrengthMeter value={password} /> : null}
      </div>

      <FormField<ResetPasswordInput, "confirmPassword">
        name="confirmPassword"
        label="Confirm new password"
      >
        {(field) => <PasswordField {...field} autoComplete="new-password" />}
      </FormField>

      <FormError />

      <SubmitButton
        variant="brand"
        size={AUTH_BUTTON_SIZE}
        className="w-full"
        pendingLabel="Updating password…"
      >
        Update password
      </SubmitButton>
    </Form>
  );
}
