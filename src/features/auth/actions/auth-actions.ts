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
import { routes, safeRedirectPath } from "@/lib/routes";
import { enforceRateLimit, rateLimitMessage, type RateLimitResult } from "@/services/rate-limit";
import { logActivity } from "@/services/supabase/admin";
import { createSupabaseServerClient, getCurrentUser } from "@/services/supabase/server";

import { authErrorMessage, GENERIC_AUTH_ERROR } from "../lib/auth-errors";
import { AUTH_RATE_LIMITS } from "../lib/rate-limits";
import { emailRedirectTo, RECOVERY_FLOW } from "../lib/recovery-flow";
import { getRecoveryPrincipal } from "../lib/recovery-session";
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
): Promise<RateLimitResult> {
  const { ip } = await getRequestContext();

  const byEmail = await enforceRateLimit(rule, rateLimitSubject(`${rule.action}:email`, email));

  if (!byEmail.allowed) {
    return byEmail;
  }

  // Null when the request carried no forwarded-for header at all. Skipping the
  // second bucket is fine then — the first one already applies.
  if (!ip) {
    return byEmail;
  }

  return enforceRateLimit(rule, rateLimitSubject(`${rule.action}:ip`, ip));
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

  const limit = await checkCredentialLimits(AUTH_RATE_LIMITS.signUp, email);

  if (!limit.allowed) {
    return actionError(rateLimitMessage(limit.reason));
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

  const limit = await checkCredentialLimits(AUTH_RATE_LIMITS.signIn, email);

  if (!limit.allowed) {
    return actionError(rateLimitMessage(limit.reason));
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
    const limit = await enforceRateLimit(
      AUTH_RATE_LIMITS.oauthStart,
      rateLimitSubject("auth.oauth_start:ip", ip),
    );

    if (!limit.allowed) {
      return actionError(rateLimitMessage(limit.reason));
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
 * since it needs no password guess. Every provider error is logged and none is
 * shown, GoTrue's send throttle included: it fires per address, so surfacing it
 * would answer the same question the generic response exists to refuse. Our own
 * per-email bucket above is different — it fills identically for an address with no
 * account, so reporting it leaks nothing and tells the user why no mail arrived.
 */
export async function requestPasswordResetAction(
  input: ForgotPasswordInput,
): Promise<ActionFailure> {
  const parsed = forgotPasswordSchema.safeParse(input);

  if (!parsed.success) {
    return actionError("Enter a valid email address.");
  }

  const { email } = parsed.data;

  const limit = await checkCredentialLimits(AUTH_RATE_LIMITS.passwordReset, email);

  if (!limit.allowed) {
    return actionError(rateLimitMessage(limit.reason));
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // The marker is what identifies the return hop as recovery. GoTrue's own
    // `type=recovery` sits on the verify link and does not survive the redirect it
    // issues, so without this the callback cannot tell this apart from a signup
    // confirmation and lands the user on the dashboard instead of the reset form.
    redirectTo: emailRedirectTo(routes.resetPassword, RECOVERY_FLOW),
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
 * SECURITY: the authority is a *recovery* session, not any session. This is the one
 * action that changes a credential without checking the current one, so accepting
 * whoever the cookie says is signed in would make a stolen session cookie enough to
 * lock the real owner out — and it would route straight around
 * `changePasswordAction`, which re-authenticates for exactly that reason. GoTrue's
 * `secure_password_change` does not cover the gap: it demands reauthentication only
 * once the session is more than 24 hours old, so a fresh sign-in passes it. See
 * `getRecoveryPrincipal`, which reads the verified `amr` claim.
 */
export async function resetPasswordAction(input: ResetPasswordInput): Promise<ActionFailure> {
  const parsed = resetPasswordSchema.safeParse(input);

  if (!parsed.success) {
    return actionError("Check the form and try again.");
  }

  const principal = await getRecoveryPrincipal();

  if (!principal) {
    // Either there is no session, or the one there was not minted by a recovery
    // link within the link's lifetime. Both mean the same thing to the user, and
    // saying which would tell an attacker holding a session what they are missing.
    return actionError("That link has expired. Request a new one.");
  }

  // A session alone must not buy unlimited password writes: the endpoint is
  // reachable by anyone who can replay the cookie, and each call is a takeover
  // attempt if the session was not theirs.
  const limit = await enforceRateLimit(
    AUTH_RATE_LIMITS.passwordResetConfirm,
    rateLimitSubject(`${AUTH_RATE_LIMITS.passwordResetConfirm.action}:user`, principal.userId),
  );

  if (!limit.allowed) {
    return actionError(rateLimitMessage(limit.reason));
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return actionError(authErrorMessage(error), { password: authErrorMessage(error) });
  }

  const { ip, userAgent } = await getRequestContext();

  await logActivity({
    userId: principal.userId,
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
 * SECURITY: same enumeration rule as password reset, and the same implementation of
 * it — every provider outcome is logged and none is shown. GoTrue's own send
 * throttle is the reason that has to be absolute here rather than "everything
 * except rate limiting": `resend` returns `over_email_send_rate_limit` only when
 * there is an unconfirmed account to re-mail, and a plain success for an address it
 * has never seen. Measured locally, that difference shows up on the *first* attempt,
 * so our own per-email bucket does not mask it — forwarding the code told an
 * attacker which addresses have accounts pending confirmation.
 *
 * `resend` being a no-op for an already-confirmed user is the behaviour we want
 * anyway: nothing distinguishes it from a fresh signup that has not clicked through.
 */
export async function resendVerificationAction(
  input: ResendVerificationInput,
): Promise<ActionFailure> {
  const parsed = resendVerificationSchema.safeParse(input);

  if (!parsed.success) {
    return actionError("Enter a valid email address.");
  }

  const { email } = parsed.data;

  const limit = await checkCredentialLimits(AUTH_RATE_LIMITS.resendVerification, email);

  if (!limit.allowed) {
    return actionError(rateLimitMessage(limit.reason));
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: emailRedirectTo(routes.dashboard) },
  });

  if (error) {
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
