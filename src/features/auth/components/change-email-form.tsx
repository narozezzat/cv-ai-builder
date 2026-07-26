"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Form, FormError, FormField, runAction, SubmitButton } from "@/components/shared/form";
import { Input } from "@/components/ui/input";

import { changeEmailAction } from "../actions/account-actions";
import { changeEmailSchema, type ChangeEmailInput } from "../schema/account-schema";
import { PasswordField } from "./password-field";

interface ChangeEmailFormProps {
  /** The address currently on the account, shown so the user knows what changes. */
  currentEmail: string;
}

/**
 * Starts an email change. Both the old and new addresses must confirm before it
 * takes effect, so the form stays on screen and reports "check your inbox" rather
 * than claiming the address has moved.
 */
export function ChangeEmailForm({ currentEmail }: ChangeEmailFormProps) {
  const form = useForm<ChangeEmailInput>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { email: "", currentPassword: "" },
    mode: "onBlur",
  });

  return (
    <Form
      form={form}
      className="space-y-4"
      onSubmit={(values) =>
        runAction(
          form,
          () => changeEmailAction(values),
          (result) => {
            form.reset();
            toast.success(result.message ?? "Check both inboxes to confirm the change.");
          },
        )
      }
    >
      <FormField<ChangeEmailInput, "email">
        name="email"
        label="New email address"
        description={`Currently ${currentEmail}.`}
      >
        {(field) => (
          <Input
            {...field}
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            autoCapitalize="off"
            placeholder="you@example.com"
          />
        )}
      </FormField>

      <FormField<ChangeEmailInput, "currentPassword">
        name="currentPassword"
        label="Current password"
        description="Confirms it is you before we touch the address that recovers this account."
      >
        {(field) => <PasswordField {...field} className="h-8" autoComplete="current-password" />}
      </FormField>

      <FormError />

      <SubmitButton pendingLabel="Sending…">Send confirmation links</SubmitButton>
    </Form>
  );
}
