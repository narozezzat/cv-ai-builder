import type { Metadata } from "next";

import { ButtonLink } from "@/components/shared";
import { AuthCard, AuthErrorAlert, getRecoveryPrincipal, ResetPasswordForm } from "@/features/auth";
import { routes } from "@/lib/routes";
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
   * here. The proof of mailbox possession is therefore in the session, but it is the
   * session's *origin* that proves it, not its existence: an ordinary signed-in
   * visitor must not be offered a form that sets a password without asking for the
   * current one. `getRecoveryPrincipal` checks the verified `amr` claim, and
   * `resetPasswordAction` checks it again — this one only decides what to render.
   */
  const principal = await getRecoveryPrincipal();

  if (!principal) {
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
      description={`Setting a new password for ${principal.email ?? "your account"}.`}
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
