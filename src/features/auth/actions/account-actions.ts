"use server";

/**
 * Credential changes for a signed-in user.
 *
 * These live in the auth feature rather than in `profile` because they are GoTrue
 * mutations, not profile-row writes: the password never touches `public.profiles`,
 * and the email column there is a denormalized copy kept in step by the
 * `handle_user_email_change` trigger once the change is confirmed.
 *
 * SECURITY: both actions re-authenticate with the current password before doing
 * anything. A session cookie alone is not sufficient authority to change the
 * credentials that recover the account — otherwise a single stolen session becomes
 * permanent ownership, with the real user locked out of their own recovery email.
 *
 * Unlike the sign-in actions these return `{ ok: true }` instead of redirecting.
 * The session identity is unchanged, so there is nothing a fresh navigation would
 * reveal that `revalidatePath` does not, and staying on the settings page is what
 * the user expects after saving a form there.
 */

import { revalidatePath } from "next/cache";

import { actionError, actionSuccess, type ActionResult } from "@/components/shared/form";
import { getRequestContext, rateLimitSubject } from "@/lib/request";
import { routes } from "@/lib/routes";
import { absoluteUrl } from "@/lib/site";
import { enforceRateLimit, RATE_LIMITED_MESSAGE } from "@/services/rate-limit";
import { logActivity } from "@/services/supabase/admin";
import { createSupabaseServerClient, requireUser } from "@/services/supabase/server";

import { authErrorMessage } from "../lib/auth-errors";
import { AUTH_RATE_LIMITS } from "../lib/rate-limits";
import {
  changeEmailSchema,
  changePasswordSchema,
  type ChangeEmailInput,
  type ChangePasswordInput,
} from "../schema/account-schema";

const INCORRECT_PASSWORD = "That password is incorrect.";

/**
 * Proves the caller knows the account's current password.
 *
 * `signInWithPassword` is the check: it is the only path that verifies a password
 * against GoTrue's hash. The side effect is a rotated session for the same user,
 * which is harmless — and arguably desirable, since a successful re-auth is a good
 * moment to refresh the token.
 */
async function verifyPassword(email: string, password: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  return !error;
}

// ── Password ──────────────────────────────────────────────────────────────────

export async function changePasswordAction(input: ChangePasswordInput): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);

  if (!parsed.success) {
    return actionError("Check the form and try again.");
  }

  const user = await requireUser();

  // An OAuth-only account has no password to verify or replace. GoTrue would
  // happily set one, which sounds helpful but creates a second way into the
  // account that the user never asked for.
  if (!user.email) {
    return actionError("This account signs in with a social provider.");
  }

  const { allowed } = await enforceRateLimit(
    AUTH_RATE_LIMITS.passwordChange,
    rateLimitSubject("auth.password_change:user", user.id),
  );

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  if (!(await verifyPassword(user.email, parsed.data.currentPassword))) {
    return actionError(INCORRECT_PASSWORD, { currentPassword: INCORRECT_PASSWORD });
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return actionError(authErrorMessage(error), { password: authErrorMessage(error) });
  }

  const { ip, userAgent } = await getRequestContext();

  await logActivity({
    userId: user.id,
    action: "auth.password_change",
    entityType: "auth",
    ipAddress: ip,
    userAgent,
  });

  // The re-authentication above issued a new session cookie, so cached RSC
  // payloads for this browser were rendered against the old one.
  revalidatePath("/", "layout");

  return actionSuccess("Password updated.");
}

// ── Email ─────────────────────────────────────────────────────────────────────

/**
 * Starts an email change. Nothing moves until both addresses confirm.
 *
 * `double_confirm_changes = true` in `supabase/config.toml` makes GoTrue mail the
 * old address as well as the new one, so a change the owner did not initiate can be
 * caught before it completes. That is also why this returns a "check your inbox"
 * message rather than reporting success: the address on the account is unchanged
 * at this point.
 */
export async function changeEmailAction(input: ChangeEmailInput): Promise<ActionResult> {
  const parsed = changeEmailSchema.safeParse(input);

  if (!parsed.success) {
    return actionError("Enter a valid email address.");
  }

  const user = await requireUser();

  if (!user.email) {
    return actionError("This account signs in with a social provider.");
  }

  const { allowed } = await enforceRateLimit(
    AUTH_RATE_LIMITS.emailChange,
    rateLimitSubject("auth.email_change:user", user.id),
  );

  if (!allowed) {
    return actionError(RATE_LIMITED_MESSAGE);
  }

  if (parsed.data.email === user.email.toLowerCase()) {
    return actionError("That is already your email address.", {
      email: "That is already your email address.",
    });
  }

  if (!(await verifyPassword(user.email, parsed.data.currentPassword))) {
    return actionError(INCORRECT_PASSWORD, { currentPassword: INCORRECT_PASSWORD });
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    // Confirming either link lands on our callback, which exchanges the code and
    // then sends the user back to the page they started from.
    { emailRedirectTo: absoluteUrl(routes.authCallback) },
  );

  if (error) {
    // SECURITY: `email_exists` is the one code worth suppressing here. Reflecting
    // it turns this form into an account-existence oracle for any address the
    // attacker cares to type, which is the same leak the signup flow avoids.
    if (error.code === "email_exists") {
      return actionSuccess("Check both inboxes to confirm the change.");
    }

    return actionError(authErrorMessage(error), { email: authErrorMessage(error) });
  }

  const { ip, userAgent } = await getRequestContext();

  await logActivity({
    userId: user.id,
    action: "auth.email_change_requested",
    entityType: "auth",
    ipAddress: ip,
    userAgent,
  });

  revalidatePath("/", "layout");

  return actionSuccess("Check both inboxes to confirm the change.");
}
