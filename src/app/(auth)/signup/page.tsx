import type { Metadata } from "next";

import {
  AuthCard,
  AuthCardLink,
  AuthErrorAlert,
  configuredOAuthProviders,
  OAuthButtons,
  SignupForm,
} from "@/features/auth";
import { routes } from "@/lib/routes";
import { param, type SearchParamsPromise } from "@/utils/search-params";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create a free account and build an ATS-ready resume in minutes.",
  alternates: { canonical: routes.signup },
  robots: { index: false, follow: false },
};

export default async function SignupPage({ searchParams }: { searchParams: SearchParamsPromise }) {
  const params = await searchParams;
  const providers = configuredOAuthProviders();

  return (
    <AuthCard
      title="Create your account"
      description="Free to start. No card, no trial countdown."
      footer={
        <AuthCardLink prompt="Already have an account?" href={routes.login} label="Sign in" />
      }
    >
      <AuthErrorAlert code={param(params, "error_code")} />

      <OAuthButtons providers={providers} className="mb-6" />

      <SignupForm />
    </AuthCard>
  );
}
