/**
 * Turns a GoTrue error into something a user can act on.
 *
 * SECURITY: the mapping is where account enumeration is either prevented or
 * introduced. Sign-in must answer identically whether the address is unknown or
 * the password is wrong — otherwise the login form becomes an oracle for "does
 * this person have an account here", which is exactly what credential-stuffing
 * lists are built from. `invalid_credentials` is the only code allowed to explain
 * a failed sign-in, and it says nothing about which half failed.
 *
 * Anything unrecognized collapses to a generic message. Provider error text is
 * written for developers, occasionally quotes internals, and is not something to
 * reflect verbatim into a page.
 */

import { AuthError, type AuthApiError } from "@supabase/supabase-js";

/** Shown when there is nothing specific and safe to say. */
export const GENERIC_AUTH_ERROR = "Something went wrong. Try again in a moment.";

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Email or password is incorrect.",
  email_not_confirmed: "Confirm your email address first — check your inbox for the link.",
  email_address_invalid: "That email address was rejected. Check it for typos.",
  email_address_not_authorized: "That email address is not allowed to sign up.",
  signup_disabled: "New accounts are temporarily closed.",
  email_provider_disabled: "Email sign-in is unavailable right now.",
  provider_disabled: "That sign-in method is unavailable right now.",
  weak_password: "That password is too easy to guess. Try a longer one.",
  same_password: "Choose a password you have not used here before.",
  reauthentication_needed: "For your security, sign in again before changing your password.",
  over_request_rate_limit: "Too many attempts. Wait a minute and try again.",
  over_email_send_rate_limit: "Too many emails sent. Wait a few minutes before trying again.",
  otp_expired: "That link has expired. Request a new one.",
  flow_state_expired: "That link has expired. Request a new one.",
  flow_state_not_found: "That link is no longer valid. Request a new one.",
  bad_code_verifier: "Open the link in the same browser you requested it from.",
  validation_failed: "Check the form and try again.",
  user_banned: "This account is suspended. Contact support.",
  session_expired: "Your session expired. Sign in again.",
};

function isAuthApiError(error: unknown): error is AuthApiError {
  return error instanceof AuthError;
}

/**
 * `error.code` is the stable identifier; `status` and `message` are not. Matching
 * on message text breaks the first time the provider rewords a string, and has
 * historically been how enumeration leaks get reintroduced.
 */
export function authErrorMessage(error: unknown): string {
  if (isAuthApiError(error) && error.code) {
    return MESSAGES[error.code] ?? GENERIC_AUTH_ERROR;
  }

  return GENERIC_AUTH_ERROR;
}

/** Codes that mean "this link is spent", so the UI can offer a fresh one. */
export function isExpiredLinkError(code: string | null | undefined): boolean {
  return (
    code === "otp_expired" ||
    code === "flow_state_expired" ||
    code === "flow_state_not_found" ||
    code === "bad_code_verifier"
  );
}

/**
 * Maps a callback URL's `error_code` query parameter, which arrives as a bare
 * string because the failure happened at the provider rather than in an SDK call.
 */
export function callbackErrorMessage(code: string | null): string {
  if (!code) {
    return GENERIC_AUTH_ERROR;
  }

  if (code === "access_denied") {
    return "Sign-in was cancelled.";
  }

  return MESSAGES[code] ?? GENERIC_AUTH_ERROR;
}
