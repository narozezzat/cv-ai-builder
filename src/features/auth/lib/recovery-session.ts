/**
 * Is the current session allowed to set a new password without knowing the old one?
 *
 * SECURITY: `/reset-password` and `resetPasswordAction` are the one place in the app
 * where credentials change with no current-password check, so "there is a session"
 * is not the right question — `changePasswordAction` re-authenticates precisely
 * because a stolen session cookie must not become permanent ownership. GoTrue does
 * not backstop us here: `secure_password_change` only demands reauthentication once
 * the session is older than 24 hours, so a fresh sign-in updates a password freely.
 *
 * The `amr` (authentication method reference) claim is the only signal that says how
 * a session was minted. Measured against a local GoTrue: a password sign-in reports
 * `[{"method":"password"}]`, a PKCE recovery exchange `[{"method":"recovery"}]`, and
 * `verifyOtp({ type: "recovery" })` `[{"method":"otp"}]`.
 */

import { createSupabaseServerClient } from "@/services/supabase/server";

/**
 * Methods that mean "a link sent to this account's mailbox was opened". Mailbox
 * possession is the authority a recovery link confers, and `otp` — signup
 * confirmation, email change, the implicit recovery flow — proves exactly the same
 * thing. `password` and `oauth` prove something else and are not accepted.
 */
const RECOVERY_METHODS: readonly string[] = ["recovery", "otp"];

/**
 * How long that proof lasts. `amr` is stamped once, when the method was used, and
 * then survives every refresh-token rotation for the session's whole life — so
 * without a window a recovery session from a week ago would still authorize a
 * password change. One hour matches `otp_expiry` in `supabase/config.toml`: the
 * link's own lifetime.
 */
export const RECOVERY_AUTHORITY_WINDOW_SECONDS = 60 * 60;

interface AmrEntry {
  method: string;
  timestamp: number;
}

/** The subset of the access token's payload this decision reads. */
export interface RecoveryClaims {
  sub?: string;
  email?: string;
  amr?: unknown;
}

function isAmrEntry(value: unknown): value is AmrEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as AmrEntry).method === "string" &&
    typeof (value as AmrEntry).timestamp === "number"
  );
}

/**
 * Pure so it can be tested exhaustively. Every case it cannot prove is a denial:
 * absent `amr`, the RFC-8176 string form (`["recovery"]`, which carries no
 * timestamp to check), a stamp outside the window, a stamp in the future.
 */
export function hasRecoveryAuthority(claims: RecoveryClaims, nowSeconds: number): boolean {
  if (!Array.isArray(claims.amr)) {
    return false;
  }

  return claims.amr.some((entry) => {
    if (!isAmrEntry(entry) || !RECOVERY_METHODS.includes(entry.method)) {
      return false;
    }

    const age = nowSeconds - entry.timestamp;

    return age >= 0 && age <= RECOVERY_AUTHORITY_WINDOW_SECONDS;
  });
}

export interface RecoveryPrincipal {
  userId: string;
  email: string | null;
}

/**
 * The user this recovery session is for, or null if the session is not one.
 *
 * `getClaims()` rather than `getSession()`: it verifies the JWT (locally against the
 * project's asymmetric signing key, or via the auth server for a symmetric secret)
 * instead of decoding whatever the cookie happens to contain. Reading `amr` out of
 * an unverified token would let a forged cookie assert its own authorization.
 */
export async function getRecoveryPrincipal(): Promise<RecoveryPrincipal | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return null;
  }

  const claims = data.claims as RecoveryClaims;

  if (!claims.sub || !hasRecoveryAuthority(claims, Math.floor(Date.now() / 1000))) {
    return null;
  }

  return { userId: claims.sub, email: claims.email ?? null };
}
