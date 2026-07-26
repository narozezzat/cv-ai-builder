"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Form, FormError, FormField, runAction, SubmitButton } from "@/components/shared/form";

import { changePasswordAction } from "../actions/account-actions";
import { changePasswordSchema, type ChangePasswordInput } from "../schema/account-schema";
import { PasswordField } from "./password-field";
import { PasswordStrengthMeter } from "./password-strength-meter";

/**
 * Changes the password of an already-signed-in account.
 *
 * Unlike `ResetPasswordForm` this asks for the current password, because the proof
 * of ownership here is weaker: a session cookie, not possession of the mailbox.
 *
 * Settings controls use the app's compact scale (`h-8`), not the taller auth-screen
 * sizing — this form sits in a page of dense panels rather than alone on a card.
 */
export function ChangePasswordForm() {
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
    mode: "onBlur",
  });

  const password = useWatch({ control: form.control, name: "password" });

  return (
    <Form
      form={form}
      className="space-y-4"
      onSubmit={(values) =>
        runAction(
          form,
          () => changePasswordAction(values),
          (result) => {
            // Clearing the fields matters more than the toast: leaving a password
            // sitting in a form on a shared screen is the failure mode here.
            form.reset();
            toast.success(result.message ?? "Password updated.");
          },
        )
      }
    >
      <FormField<ChangePasswordInput, "currentPassword">
        name="currentPassword"
        label="Current password"
      >
        {(field) => <PasswordField {...field} className="h-8" autoComplete="current-password" />}
      </FormField>

      <div className="space-y-3">
        <FormField<ChangePasswordInput, "password"> name="password" label="New password">
          {(field) => <PasswordField {...field} className="h-8" autoComplete="new-password" />}
        </FormField>

        {password ? <PasswordStrengthMeter value={password} /> : null}
      </div>

      <FormField<ChangePasswordInput, "confirmPassword">
        name="confirmPassword"
        label="Confirm new password"
      >
        {(field) => <PasswordField {...field} className="h-8" autoComplete="new-password" />}
      </FormField>

      <FormError />

      <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
    </Form>
  );
}
