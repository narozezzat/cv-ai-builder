import type { Metadata } from "next";

import { ButtonLink } from "@/components/shared";
import { AuthCard, AuthErrorAlert, ResetPasswordForm } from "@/features/auth";
import { routes } from "@/lib/routes";
import { getCurrentUser } from "@/services/supabase/server";
import { param, type SearchParamsPromise } from "@/utils/search-params";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your account.",
  alternates: { canonical: routes.resetPassword },
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParamsPromise;
}) {
  const params = await searchParams;

  /**
   * SECURITY: a recovery link is spendable exactly once, and `/auth/callback` is
   * what spends it — the token is exchanged for a session before the user is sent
   * here. So the presence of a session *is* the proof of mailbox possession, and
   * this check is the authorization for changing the password. Its absence means
   * the link expired, was already used, or someone navigated here directly.
   *
   * `updateUser` on the server would reject an unauthenticated call anyway, so
   * rendering the form regardless would only mean asking for a password twice
   * before failing.
   */
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AuthCard
        title="This link is no longer valid"
        description="Reset links expire after an hour and can only be used once."
      >
        <AuthErrorAlert code={param(params, "error_code")} />

        <div className="space-y-3">
          <ButtonLink variant="brand" size="lg" className="w-full" href={routes.forgotPassword}>
            Request a new link
          </ButtonLink>
          <ButtonLink variant="ghost" size="lg" className="w-full" href={routes.login}>
            Back to sign in
          </ButtonLink>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      // The address is shown because arriving here is the end of an email round-trip:
      // seeing which account is being changed is how a user catches a link opened in
      // the wrong browser profile.
      description={`Setting a new password for ${user.email ?? "your account"}.`}
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
