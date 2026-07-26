import type { Metadata } from "next";

import {
  AuthCard,
  AuthCardLink,
  AuthErrorAlert,
  configuredOAuthProviders,
  LoginForm,
  OAuthButtons,
} from "@/features/auth";
import { routes, safeRedirectPath } from "@/lib/routes";
import { param, type SearchParamsPromise } from "@/utils/search-params";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your account to keep building your resume.",
  alternates: { canonical: routes.login },
  // Nothing here is useful in a search result, and an indexed login page is a
  // reliable way to leak query parameters into someone else's index.
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: SearchParamsPromise }) {
  const params = await searchParams;

  // Validated here as well as in the action. This copy exists so the value that
  // reaches `<OAuthButtons>` — and from there a hidden round-trip through the
  // provider — is already known to be a same-origin path.
  const rawNext = param(params, "next");
  const next = rawNext ? safeRedirectPath(rawNext) : undefined;
  const providers = configuredOAuthProviders();

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to pick up where you left off."
      // No `next` on the signup link: signup ends at the verification screen, so a
      // destination carried across would be dropped there anyway.
      footer={<AuthCardLink prompt="New here?" href={routes.signup} label="Create an account" />}
    >
      <AuthErrorAlert code={param(params, "error_code")} />

      <OAuthButtons providers={providers} next={next} className="mb-6" />

      <LoginForm next={next} />
    </AuthCard>
  );
}
