/**
 * Public surface of the auth feature.
 *
 * The ESLint boundary rule lets `app/**` reach this file and nothing deeper, so
 * everything a route needs is re-exported here and the internals — actions, error
 * mapping, rate-limit buckets, field styling — stay private. Adding an export is a
 * deliberate act; reaching past this barrel is a lint error.
 */

export { AuthCard, AuthCardLink } from "./components/auth-card";
export { AuthErrorAlert, AuthNotice } from "./components/auth-notice";
export { ChangeEmailForm } from "./components/change-email-form";
export { ChangePasswordForm } from "./components/change-password-form";
export { ForgotPasswordForm } from "./components/forgot-password-form";
export { LoginForm } from "./components/login-form";
export { OAuthButtons } from "./components/oauth-buttons";
export { ResendVerificationForm } from "./components/resend-verification-form";
export { ResetPasswordForm } from "./components/reset-password-form";
export { SignOutButton } from "./components/sign-out-button";
export { SignupForm } from "./components/signup-form";

/**
 * Exported for menus and headers that need sign-out as a form action rather than as
 * `<SignOutButton>` — a dropdown item, for instance, must be the submit button
 * itself to keep its `role="menuitem"` and keyboard behaviour.
 */
export { signOutAction } from "./actions/auth-actions";

export { configuredOAuthProviders } from "./lib/providers";

/**
 * The recovery flow's two halves, both needed outside the feature: `/auth/callback`
 * decides where a mail link lands, and `/reset-password` decides whether the session
 * it arrived with may set a password.
 */
export { callbackTargets, otpType } from "./lib/recovery-flow";
export { getRecoveryPrincipal } from "./lib/recovery-session";

export type { OAuthProvider } from "./schema/auth-schema";
