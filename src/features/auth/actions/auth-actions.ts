"use server";

/**
 * Every auth mutation. Nothing in the browser talks to GoTrue directly.
 *
 * SECURITY: a `"use server"` export is a public HTTP endpoint with a generated
 * name, not a private function. The form is merely its most convenient caller —
 * anyone can POST arbitrary JSON at it. So each action here re-validates its
 * input with the same Zod schema the form used, derives its rate-limit subject
 * from request headers rather than from that input, and maps provider errors
 * through `authErrorMessage` instead of reflecting them.
 *
 * Two structural rules, both easy to get wrong:
 *
 * 1. `redirect()` works by throwing. It must never sit inside a `try` whose
 *    `catch` swallows — the `NEXT_REDIRECT` signal would be caught and reported
 *    as a generic failure, leaving the user on a form that appears broken but in
 *    fact succeeded. Every redirect below is after the last `catch`.
 * 2. Success is a redirect, failure is a return value. There is no `{ ok: true }`
 *    for the client to route on, because a session change has to be followed by a
 *    fresh server render — the new cookie is only visible to RSC after navigation.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { actionError, type ActionFailure } from "@/components/shared/form";
import { isOAuthConfigured } from "@/lib/env/server";
import { getRequestContext, rateLimitSubject } from "@/lib/request";
import { NEXT_PARAM, routes, safeRedirectPath } from "@/lib/routes";
import { absoluteUrl } from "@/lib/site";
import { enforceRateLimit, RATE_LIMITED_MESSAGE } from "@/services/rate-limit";
import { logActivity } from "@/services/supabase/admin";
import { createSupabaseServerClient, getCurrentUser } from "@/services/supabase/server";

import { authErrorMessage, GENERIC_AUTH_ERROR } from "../lib/auth-errors";
import { AUTH_RATE_LIMITS } from "../lib/rate-limits";
import {
  forgotPasswordSchema,
  oauthProviderSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ForgotPasswordInput,
  type OAuthProvider,
  type ResendVerificationInput,
  type ResetPasswordInput,
  type SignInInput,
  type SignUpInput,
} from "../schema/auth-schema";

/**
 * Where GoTrue sends the user after they click a link in an email.
 *
 * Always our own callback route, never a URL derived from input. `next` rides
 * along as a relative path and is re-validated when the callback reads it, so a
 * tampered confirmation link cannot turn into an off-site redirect carrying a
 * fresh session.
 */
function emailRedirectTo(next: string): string {
  const params = new URLSearchParams({ [NEXT_PARAM]: next });

  return absoluteUrl(`${routes.authCallback}?${params.toString()}`);
}

/**
 * Rate-limit key for an unauthenticated attempt.
 *
 * Two buckets, both consumed, because they stop different attacks: the per-email
 * bucket stops a password list being walked against one account from many IPs,
 * and the per-IP bucket stops one host spraying one password across many
 * accounts. Limiting on only one of them leaves the other wide open.
 */
async function checkCredentialLimits(
  rule: (typeof AUTH_RATE_LIMITS)[keyof typeof AUTH_RATE_LIMITS],
  email: string,
): Promise<boolean> {
  const { ip } = await getRequestContext();

  const byEmail = await enforceRateLimit(rule, rateLimitSubject(`${rule.action}:email`, email));

  if (!byEmail.allowed) {
    return false;
  }

  // Absent locally, where there is no proxy to set the header. Skipping the
  // second bucket is fine there — the first one already applies.
  if (!ip) {
    return true;
  }

  const byIp = await enforceRateLimit(rule, rateLimitSubject(`${rule.action}:ip`, ip));

  return byIp.allowed;
}

// ── Sign up ───────────────────────────────────────────────────────────────────

/**
 * Creates an account and sends the confirmation email.
 *
 * SECURITY: the response is identical whether or not the address is already
 * registered. GoTrue supports this deliberately — with confirmations enabled it
 * returns a user object with an empty `identities` array for an existing address
 * and quietly emails the real owner instead of the person filling in the form.
 * Branching on that to say "this email is taken" would turn signup into an
 * account-existence oracle, so we ignore it and always land on `/verify-email`.
 */
export async function signUpAction(input: SignUpInput): Promise<ActionFailure> {
  const parsed = signUpSchema.safeParse(input);

  if (!parsed.success) {
    return actionError("Check the form and try again.");
  }

  const { email, password, fullName } = parsed.data;

  if (!(await checkCredentialLimits(AUTH_RATE_LIMITS.signUp, email))) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the `handle_new_user` trigger, which coalesces `full_name` with
      // the `name` that OAuth providers send.
      data: { full_name: fullName },
      emailRedirectTo: emailRedirectTo(routes.dashboard),
    },
  });

  if (error) {
    return actionError(authErrorMessage(error));
  }

  redirect(`${routes.verifyEmail}?email=${encodeURIComponent(email)}`);
}

// ── Sign in ───────────────────────────────────────────────────────────────────

/**
 * Exchanges a password for a session.
 *
 * `next` arrives from the query string, which means it arrives from whoever wrote
 * the link the user clicked. `safeRedirectPath` is what stops it being an open
 * redirect; see the note in `src/middleware.ts`.
 */
export async function signInAction(
  input: SignInInput,
  next?: string | null,
): Promise<ActionFailure> {
  const parsed = signInSchema.safeParse(input);

  if (!parsed.success) {
    // Not "email is invalid" — the form already said that, and a server-side
    // rejection here is either a tampered request or a stale client.
    return actionError("Email or password is incorrect.");
  }

  const { email, password } = parsed.data;

  if (!(await checkCredentialLimits(AUTH_RATE_LIMITS.signIn, email))) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return actionError(authErrorMessage(error));
  }

  if (data.user) {
    const { ip, userAgent } = await getRequestContext();

    await logActivity({
      userId: data.user.id,
      action: "auth.sign_in",
      metadata: { method: "password" },
      ipAddress: ip,
      userAgent,
    });
  }

  // The session cookie was just written, so every cached RSC payload for this
  // browser is now stale — including layouts that render the signed-out header.
  revalidatePath("/", "layout");

  redirect(safeRedirectPath(next));
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

/**
 * Starts a social sign-in.
 *
 * On the server `signInWithOAuth` performs no navigation: it mints the PKCE
 * verifier, writes it to a cookie — which a Server Action can do, unlike an RSC —
 * and hands back the provider URL for us to redirect to. Doing this server-side
 * rather than in the browser keeps the verifier in an httpOnly cookie.
 *
 * The provider is validated against an allowlist even though the UI only renders
 * two buttons, because the argument is attacker-controlled like any other.
 */
export async function signInWithOAuthAction(
  provider: OAuthProvider,
  next?: string | null,
): Promise<ActionFailure> {
  const parsedProvider = oauthProviderSchema.safeParse(provider);

  if (!parsedProvider.success) {
    return actionError("That sign-in method is unavailable right now.");
  }

  // Without credentials Supabase answers with a provider error the user cannot
  // act on. The buttons are hidden in that case; this covers a direct call.
  if (!isOAuthConfigured(parsedProvider.data)) {
    return actionError("That sign-in method is unavailable right now.");
  }

  const { ip } = await getRequestContext();

  if (ip) {
    const { allowed } = await enforceRateLimit(
      AUTH_RATE_LIMITS.oauthStart,
      rateLimitSubject("auth.oauth_start:ip", ip),
    );

    if (!allowed) {
      return actionError(RATE_LIMITED_MESSAGE);
    }
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: parsedProvider.data,
    options: {
      redirectTo: emailRedirectTo(safeRedirectPath(next)),
      // Skips the SDK's own `window.location` assignment, which is a no-op on the
      // server anyway, and gives us `data.url` to redirect to ourselves.
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return actionError(error ? authErrorMessage(error) : GENERIC_AUTH_ERROR);
  }

  redirect(data.url);
}

// ── Password reset ────────────────────────────────────────────────────────────

/**
 * Emails a recovery link.
 *
 * SECURITY: always reports success, including for an address with no account.
 * "No user found with that email" is the same enumeration leak as a distinct
 * login error, and a forgot-password form is the easiest place to probe for it
 * since it needs no password guess. Provider errors are logged, not shown —
 * except rate limiting, which the user can act on.
 */
export async function requestPasswordResetAction(
  input: ForgotPasswordInput,
): Promise<ActionFailure> {
  const parsed = forgotPasswordSchema.safeParse(input);

  if (!parsed.success) {
    return actionError("Enter a valid email address.");
  }

  const { email } = parsed.data;

  if (!(await checkCredentialLimits(AUTH_RATE_LIMITS.passwordReset, email))) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: emailRedirectTo(routes.resetPassword),
  });

  if (error) {
    console.error("[auth] password reset request failed", {
      code: error.code,
      status: error.status,
    });
  }

  redirect(`${routes.forgotPassword}?sent=1`);
}

/**
 * Sets a new password using the recovery session created by the callback route.
 *
 * The authorization here is the session itself: `updateUser` acts on whoever the
 * cookie says is signed in, and the only way to hold a recovery session is to
 * have opened a link sent to that address. `secure_password_change = true` in
 * `supabase/config.toml` is what makes GoTrue require that session rather than
 * accepting a bare token.
 */
export async function resetPasswordAction(input: ResetPasswordInput): Promise<ActionFailure> {
  const parsed = resetPasswordSchema.safeParse(input);

  if (!parsed.success) {
    return actionError("Check the form and try again.");
  }

  const user = await getCurrentUser();

  if (!user) {
    // The recovery link is single-use and time-limited, so an absent session here
    // almost always means it expired between opening the mail and submitting.
    return actionError("That link has expired. Request a new one.");
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return actionError(authErrorMessage(error), { password: authErrorMessage(error) });
  }

  const { ip, userAgent } = await getRequestContext();

  await logActivity({
    userId: user.id,
    action: "auth.password_reset",
    ipAddress: ip,
    userAgent,
  });

  revalidatePath("/", "layout");

  redirect(routes.dashboard);
}

// ── Email verification ────────────────────────────────────────────────────────

/**
 * Re-sends the signup confirmation.
 *
 * Same enumeration rule as password reset: the answer does not depend on whether
 * the address exists or is already confirmed. GoTrue's `resend` is a no-op for a
 * confirmed user, which is the behaviour we want anyway.
 */
export async function resendVerificationAction(
  input: ResendVerificationInput,
): Promise<ActionFailure> {
  const parsed = resendVerificationSchema.safeParse(input);

  if (!parsed.success) {
    return actionError("Enter a valid email address.");
  }

  const { email } = parsed.data;

  if (!(await checkCredentialLimits(AUTH_RATE_LIMITS.resendVerification, email))) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: emailRedirectTo(routes.dashboard) },
  });

  if (error) {
    // Only the rate-limit codes say anything the user can act on; the rest would
    // reveal account state.
    if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
      return actionError(authErrorMessage(error));
    }

    console.error("[auth] resend verification failed", { code: error.code, status: error.status });
  }

  redirect(`${routes.verifyEmail}?email=${encodeURIComponent(email)}&sent=1`);
}

// ── Sign out ──────────────────────────────────────────────────────────────────

/**
 * Ends the session.
 *
 * `signOut` is called before the audit write so a failure to log never leaves the
 * user signed in, and the redirect is unconditional: whatever went wrong, the
 * correct destination for someone who pressed "sign out" is the login screen.
 */
export async function signOutAction(): Promise<void> {
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[auth] sign out failed", { code: error.code, status: error.status });
  }

  if (user) {
    const { ip, userAgent } = await getRequestContext();

    await logActivity({ userId: user.id, action: "auth.sign_out", ipAddress: ip, userAgent });
  }

  revalidatePath("/", "layout");

  redirect(routes.login);
}
