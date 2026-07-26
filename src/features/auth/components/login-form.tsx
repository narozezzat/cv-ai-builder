"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Form, FormError, FormField, runAction, SubmitButton } from "@/components/shared/form";
import { Input } from "@/components/ui/input";
import { routes } from "@/lib/routes";

import { signInAction } from "../actions/auth-actions";
import { AUTH_BUTTON_SIZE, AUTH_FIELD_HEIGHT } from "../lib/field-styles";
import { signInSchema, type SignInInput } from "../schema/auth-schema";
import { PasswordField } from "./password-field";

export function LoginForm({ next }: { next?: string }) {
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
    // Validating on blur rather than on change: a "not a valid email" complaint
    // while someone is still halfway through typing their address is noise.
    mode: "onBlur",
  });

  return (
    <Form form={form} onSubmit={(values) => runAction(form, () => signInAction(values, next))}>
      <FormField<SignInInput, "email"> name="email" label="Email">
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

      <FormField<SignInInput, "password"> name="password" label="Password">
        {(field) => <PasswordField {...field} autoComplete="current-password" />}
      </FormField>

      {/* A sibling row rather than a ReactNode passed as `label`: `FormField` renders
          `label` inside `<Label htmlFor>`, and a link nested in a label makes one
          click do two things. */}
      <div className="flex justify-end">
        <Link
          href={routes.forgotPassword}
          className="rounded text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          Forgot your password?
        </Link>
      </div>

      <FormError />

      <SubmitButton
        variant="brand"
        size={AUTH_BUTTON_SIZE}
        className="w-full"
        pendingLabel="Signing in…"
      >
        Sign in
      </SubmitButton>
    </Form>
  );
}
