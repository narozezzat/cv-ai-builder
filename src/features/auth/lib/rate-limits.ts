/**
 * Rate-limit buckets for the auth surface.
 *
 * GoTrue has its own per-IP limits (`[auth.rate_limit]` in `supabase/config.toml`)
 * and they are generous by design — 30 sign-in attempts per five minutes protects
 * the auth server, not an individual account. These limits sit in front of that
 * and are scoped per credential as well as per IP, which is what actually raises
 * the cost of walking a password list against one address.
 *
 * Enforcement lives in `@/services/rate-limit`; this file owns only the numbers.
 */

import type { RateLimitRule } from "@/services/rate-limit";

/**
 * Windows are Postgres interval literals, consumed by `check_rate_limit`.
 *
 * Sign-in is the tightest because it is the one endpoint where an attacker gets
 * unlimited guesses at a secret. The email-sending limits are lower still, since
 * every attempt there costs real money and puts mail in someone else's inbox —
 * the abuse case is using our signup form as a spam cannon, not account takeover.
 */
export const AUTH_RATE_LIMITS = {
  signIn: { action: "auth.sign_in", window: "15 minutes", max: 10 },
  signUp: { action: "auth.sign_up", window: "1 hour", max: 5 },
  passwordReset: { action: "auth.password_reset", window: "1 hour", max: 5 },
  resendVerification: { action: "auth.resend_verification", window: "1 hour", max: 3 },
  oauthStart: { action: "auth.oauth_start", window: "5 minutes", max: 20 },
  /**
   * Changing credentials from inside a session. Tighter than sign-in despite
   * needing a session first: a password change verifies the *current* password, so
   * an unlimited endpoint here hands an attacker with a stolen session cookie an
   * offline-speed oracle for the password they do not have — and the password is
   * what they need to lock the real owner out.
   */
  passwordChange: { action: "auth.password_change", window: "1 hour", max: 5 },
  /**
   * Submitting the reset form. Keyed per user rather than per email, because by
   * then the address is not in the request — the recovery session is. Same reason
   * as `passwordChange`: the endpoint takes no current password, so without a limit
   * a replayed session cookie gets unlimited attempts at owning the account.
   */
  passwordResetConfirm: { action: "auth.password_reset_confirm", window: "1 hour", max: 5 },
  emailChange: { action: "auth.email_change", window: "1 hour", max: 5 },
} satisfies Record<string, RateLimitRule>;
