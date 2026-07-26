import type { Metadata } from "next";

import {
  AuthCard,
  AuthCardLink,
  AuthErrorAlert,
  AuthNotice,
  ForgotPasswordForm,
} from "@/features/auth";
import { routes } from "@/lib/routes";
import { flag, param, type SearchParamsPromise } from "@/utils/search-params";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Send yourself a link to choose a new password.",
  alternates: { canonical: routes.forgotPassword },
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: SearchParamsPromise;
}) {
  const params = await searchParams;
  const sent = flag(params, "sent");

  return (
    <AuthCard
      title="Reset your password"
      description="Enter the address you signed up with and we'll send you a link."
      footer={<AuthCardLink prompt="Remembered it?" href={routes.login} label="Back to sign in" />}
    >
      <AuthErrorAlert code={param(params, "error_code")} />

      {/* SECURITY: the wording is load-bearing. The action answers identically for
          a known and an unknown address, so claiming "we sent you an email" would
          turn this screen into an account-existence oracle. */}
      {sent ? (
        <AuthNotice tone="success" title="Check your inbox">
          If an account exists for that address, a reset link is on its way. The link expires in an
          hour — request another below if it does.
        </AuthNotice>
      ) : null}

      <ForgotPasswordForm defaultEmail={param(params, "email")} />
    </AuthCard>
  );
}
