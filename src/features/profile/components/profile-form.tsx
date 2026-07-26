"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Form, FormError, FormField, runAction, SubmitButton } from "@/components/shared/form";
import { Input } from "@/components/ui/input";

import { updateProfileAction } from "../actions/profile-actions";
import {
  PROFILE_HEADLINE_MAX,
  profileInfoSchema,
  type ProfileInfoInput,
} from "../schema/profile-schema";

interface ProfileFormProps {
  /** Current values from `profiles`. `null` columns arrive as empty strings. */
  defaultValues: ProfileInfoInput;
  /**
   * The address on the account. Read-only here — changing it is a credential
   * operation that lives in the account settings and needs the password.
   */
  email: string;
}

/**
 * Display name and headline.
 *
 * Stays mounted after a successful save and resets its dirty state to the values
 * that were just written, so the button returns to a neutral state without the
 * fields flashing back to what they were before.
 */
export function ProfileForm({ defaultValues, email }: ProfileFormProps) {
  const form = useForm<ProfileInfoInput>({
    resolver: zodResolver(profileInfoSchema),
    defaultValues,
    mode: "onBlur",
  });

  const headlineLength = form.watch("headline").length;

  return (
    <Form
      form={form}
      className="space-y-4"
      onSubmit={(values) =>
        runAction(
          form,
          () => updateProfileAction(values),
          (result) => {
            // Re-baseline rather than clear: the saved values are now the truth.
            form.reset(values);
            toast.success(result.message ?? "Profile saved.");
          },
        )
      }
    >
      <FormField<ProfileInfoInput, "fullName">
        name="fullName"
        label="Full name"
        description="Shown on your resumes and across the app."
      >
        {(field) => (
          <Input {...field} autoComplete="name" placeholder="Ada Lovelace" spellCheck={false} />
        )}
      </FormField>

      <FormField<ProfileInfoInput, "headline">
        name="headline"
        label="Headline"
        description={`${headlineLength}/${PROFILE_HEADLINE_MAX} — your one-line professional summary.`}
      >
        {(field) => (
          <Input
            {...field}
            maxLength={PROFILE_HEADLINE_MAX}
            placeholder="Senior Frontend Engineer"
          />
        )}
      </FormField>

      {/*
        Not a `FormField`: the value is not part of this form's submission. It is
        here because a profile page without the account's email reads as
        incomplete, and the link is where the change actually happens.
      */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Email</p>
        <Input value={email} readOnly disabled aria-label="Account email" />
        <p className="text-xs text-muted-foreground">
          Changing this requires your password — see Account settings.
        </p>
      </div>

      <FormError />

      <SubmitButton pendingLabel="Saving…" disabled={!form.formState.isDirty}>
        Save changes
      </SubmitButton>
    </Form>
  );
}
