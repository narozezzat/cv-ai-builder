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

import { AuthError, AuthRetryableFetchError, type AuthApiError } from "@supabase/supabase-js";

/** Shown when there is nothing specific and safe to say. */
export const GENERIC_AUTH_ERROR = "Something went wrong. Try again in a moment.";

/** Shown when the request never reached the auth service at all. */
export const AUTH_UNREACHABLE_ERROR =
  "We couldn't reach the sign-in service. Check your connection and try again.";

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
 * Writes a failure the user is not allowed to see to the server log instead.
 *
 * The generic message is deliberately uninformative, which also makes a broken
 * deployment indistinguishable from a wrong password in the one place anyone
 * looks — the screen. A misconfigured `NEXT_PUBLIC_SUPABASE_URL` or a rotated
 * anon key produces `401 Invalid API key`, which GoTrue returns with no
 * `error_code` at all, so it lands in the same bucket as every other unknown and
 * then vanishes. Logging `status` and `code` is what separates "the provider
 * rejected this request" from "this build is pointed at the wrong project".
 *
 * Server-side only, and only for failures that collapse to a generic message —
 * a wrong password is not an incident. `message` is included because it is the
 * diagnostic payload; it is also exactly why none of this may travel back with
 * the response.
 */
function reportAuthFailure(reason: string, error: unknown): void {
  const detail =
    error instanceof AuthError
      ? { name: error.name, status: error.status, code: error.code, message: error.message }
      : error instanceof Error
        ? { name: error.name, message: error.message }
        : { value: String(error) };

  console.error("[auth] unhandled provider failure", { reason, ...detail });
}

/**
 * `error.code` is the stable identifier; `status` and `message` are not. Matching
 * on message text breaks the first time the provider rewords a string, and has
 * historically been how enumeration leaks get reintroduced.
 */
export function authErrorMessage(error: unknown): string {
  // The request never got an answer: wrong project URL, DNS, or an outage. Worth
  // its own message because it is the one failure in here that is not about the
  // account, and "try again" is genuinely the right advice.
  if (error instanceof AuthRetryableFetchError) {
    reportAuthFailure("unreachable", error);
    return AUTH_UNREACHABLE_ERROR;
  }

  if (isAuthApiError(error) && error.code) {
    const message = MESSAGES[error.code];

    if (message) {
      return message;
    }

    reportAuthFailure("unmapped-code", error);
    return GENERIC_AUTH_ERROR;
  }

  // No code at all. `401 Invalid API key` arrives here, and so does anything
  // that is not a GoTrue error object.
  reportAuthFailure("no-code", error);
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
