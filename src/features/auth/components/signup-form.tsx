"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { Form, FormError, FormField, runAction, SubmitButton } from "@/components/shared/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/lib/routes";

import { signUpAction } from "../actions/auth-actions";
import { AUTH_BUTTON_SIZE, AUTH_FIELD_HEIGHT } from "../lib/field-styles";
import { signUpSchema, type SignUpInput } from "../schema/auth-schema";
import { PasswordField } from "./password-field";
import { PasswordStrengthMeter } from "./password-strength-meter";

const LEGAL_LINK =
  "rounded font-medium text-foreground underline decoration-border underline-offset-4 transition-colors outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring";

export function SignupForm() {
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "", acceptTerms: false },
    mode: "onBlur",
  });

  // `useWatch` rather than `form.watch`: this subscribes only the meter, so a
  // keystroke in the password field does not re-render the whole form.
  const password = useWatch({ control: form.control, name: "password" });

  return (
    <Form form={form} onSubmit={(values) => runAction(form, () => signUpAction(values))}>
      <FormField<SignUpInput, "fullName"> name="fullName" label="Full name">
        {(field) => (
          <Input
            {...field}
            autoComplete="name"
            placeholder="Ada Lovelace"
            className={AUTH_FIELD_HEIGHT}
          />
        )}
      </FormField>

      <FormField<SignUpInput, "email"> name="email" label="Email">
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

      <div className="space-y-3">
        <FormField<SignUpInput, "password"> name="password" label="Password">
          {(field) => <PasswordField {...field} autoComplete="new-password" />}
        </FormField>

        {/* Mounted only once there is something to measure. An empty meter beside an
            empty field is three grey rules asking to be ignored. */}
        {password ? <PasswordStrengthMeter value={password} /> : null}
      </div>

      <FormField<SignUpInput, "acceptTerms"> name="acceptTerms">
        {(field) => (
          <div className="flex items-start gap-2.5">
            {/* Base UI's `Checkbox` is a `Checkbox.Root`, not an `<input>`: it takes
                `checked` / `onCheckedChange`, so the RHF field cannot be spread onto
                it and each prop is wired by hand. `id` and the `aria-*` pair come
                from `FormField` and must be forwarded, or the label points at
                nothing and the error is never announced. */}
            <Checkbox
              id={field.id}
              name={field.name}
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked)}
              onBlur={field.onBlur}
              disabled={field.disabled}
              aria-describedby={field["aria-describedby"]}
              aria-invalid={field["aria-invalid"]}
              className="mt-0.5"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {/* The links sit outside the `<Label>` on purpose. Inside it, clicking
                  "Terms" would both navigate and toggle the checkbox. */}
              <Label htmlFor={field.id} className="inline text-xs font-normal">
                I agree to the
              </Label>{" "}
              <Link href={routes.terms} className={LEGAL_LINK}>
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href={routes.privacy} className={LEGAL_LINK}>
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        )}
      </FormField>

      <FormError />

      <SubmitButton
        variant="brand"
        size={AUTH_BUTTON_SIZE}
        className="w-full"
        pendingLabel="Creating account…"
      >
        Create account
      </SubmitButton>
    </Form>
  );
}
