/**
 * Which flow a `/auth/callback` hit belongs to, and where it should land.
 *
 * Pure and separate from the route handler so the routing decision is testable
 * without a request, a session, or a running Supabase — it is the part that broke
 * silently, and the failure mode (a user who forgot their password gets signed in
 * at the dashboard, never seeing the reset form) is invisible to a type checker.
 */

import type { EmailOtpType } from "@supabase/supabase-js";

import { NEXT_PARAM, routes, safeRedirectPath } from "@/lib/routes";
import { absoluteUrl } from "@/lib/site";

/**
 * Our own marker on the callback URL, added to the recovery mail's `redirect_to`.
 *
 * GoTrue's `type=recovery` lives on the `/auth/v1/verify` link, not on the redirect
 * it issues afterwards: the PKCE hop arrives carrying `code` and `next` only. So
 * `type` cannot identify a recovery return, and the marker has to be something we
 * put there ourselves. It is readable before the code exchange, which `amr` — the
 * claim that later authorizes the password change — is not.
 */
export const RECOVERY_FLOW_PARAM = "flow";
export const RECOVERY_FLOW = "recovery";

/**
 * The `type` values GoTrue puts on an email link, narrowed to the ones this app
 * actually sends. Anything else — a hand-edited link, a flow we do not use — is
 * rejected rather than passed through to `verifyOtp`, which is the difference
 * between "unsupported link" and letting an attacker pick the verification mode.
 */
const OTP_TYPES = ["signup", "email", "recovery", "email_change", "invite"] as const;

export function otpType(value: string | null): EmailOtpType | null {
  return OTP_TYPES.includes(value as (typeof OTP_TYPES)[number]) ? (value as EmailOtpType) : null;
}

/**
 * Where GoTrue sends the user after they click a link in an email.
 *
 * Always our own callback route, never a URL derived from input. `next` rides along
 * as a relative path and is re-validated when the callback reads it, so a tampered
 * confirmation link cannot turn into an off-site redirect carrying a fresh session.
 *
 * Lives beside `callbackTargets` because the two are one decision seen from both
 * ends: this writes the parameters that one reads. A caller that forgets `next` does
 * not get an error, it gets a link that silently lands on the default destination —
 * which is how the email-change confirmation ended up at the dashboard while its
 * comment claimed it returned to the settings page.
 */
export function emailRedirectTo(next: string, flow?: string): string {
  const params = new URLSearchParams({ [NEXT_PARAM]: next });

  if (flow) {
    params.set(RECOVERY_FLOW_PARAM, flow);
  }

  return absoluteUrl(`${routes.authCallback}?${params.toString()}`);
}

export interface CallbackTargets {
  /** Where a successful exchange goes. */
  destination: string;
  /** Where a failed one goes, with `error_code` attached. */
  errorPath: string;
}

export function callbackTargets(params: URLSearchParams): CallbackTargets {
  // Either signal is sufficient: the marker covers the PKCE hop we generate, the
  // type covers a link verified through `token_hash` (admin-generated links, or a
  // mail template that embeds the hash instead of a PKCE token).
  const isRecovery =
    params.get(RECOVERY_FLOW_PARAM) === RECOVERY_FLOW || otpType(params.get("type")) === "recovery";

  /**
   * A recovery link's destination is fixed by the flow, not by `next`.
   * `safeRedirectPath` deliberately refuses `/reset-password` as a destination —
   * it is on the non-destinations list so a stray `?next=/reset-password` cannot
   * strand a normally signed-in user there — so the recovery branch has to name
   * the route itself.
   */
  return {
    destination: isRecovery
      ? routes.resetPassword
      : safeRedirectPath(params.get(NEXT_PARAM), routes.dashboard),
    // A dead recovery link is only actionable on the request form, everything else
    // on the sign-in form.
    errorPath: isRecovery ? routes.forgotPassword : routes.login,
  };
}
