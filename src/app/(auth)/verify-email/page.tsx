import { MailOpen } from "lucide-react";
import type { Metadata } from "next";

import { AuthCard, AuthCardLink, AuthNotice, ResendVerificationForm } from "@/features/auth";
import { routes } from "@/lib/routes";
import { flag, param, type SearchParamsPromise } from "@/utils/search-params";

export const metadata: Metadata = {
  title: "Confirm your email",
  description: "Confirm your email address to finish creating your account.",
  alternates: { canonical: routes.verifyEmail },
  robots: { index: false, follow: false },
};

/**
 * Where `signUpAction` lands, and where `resendVerificationAction` returns to.
 *
 * The contract with those actions is the query string: `?email=<address>` from
 * signup, plus `&sent=1` after a resend. Nothing here is authenticated — a signup
 * with an unconfirmed address has no session — so the address is display-only and
 * treated as untrusted text, never as a claim about who the visitor is.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: SearchParamsPromise;
}) {
  const params = await searchParams;
  const email = param(params, "email");
  const resent = flag(params, "sent");

  return (
    <AuthCard
      title="Confirm your email"
      description="One click in your inbox and your account is ready."
      footer={<AuthCardLink prompt="Wrong address?" href={routes.signup} label="Start over" />}
    >
      {/* SECURITY: signup redirects here whether or not the address was already
          registered, so this screen must not confirm that an account was created.
          "If you don't see it" carries no such claim; "we created your account"
          would make the page an enumeration oracle. */}
      {resent ? (
        <AuthNotice tone="success" title="Sent again">
          If that address needs confirming, a new link is on its way. Only the most recent link
          works.
        </AuthNotice>
      ) : null}

      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand/12 text-brand">
          <MailOpen className="size-5" aria-hidden />
        </span>
        <p className="text-sm text-balance text-muted-foreground">
          We sent a confirmation link{email ? " to " : " to the address you signed up with"}
          {email ? <span className="font-medium text-foreground">{email}</span> : null}. Open it to
          finish signing up — the link expires in 24 hours.
        </p>
        <p className="text-xs text-balance text-muted-foreground">
          If you don&apos;t see it, check spam, then send it again below.
        </p>
      </div>

      <ResendVerificationForm defaultEmail={email} />
    </AuthCard>
  );
}
