/**
 * @vitest-environment node
 *
 * The two actions that mail a link to an address nobody has proven they own:
 * `requestPasswordResetAction` and `resendVerificationAction`. Both are reachable
 * without a session, both take an arbitrary address, and both are therefore the
 * cheapest place in the product to ask "does this person have an account here?".
 *
 * The property under test is that they cannot answer. Not that they answer
 * politely — that every outcome GoTrue can produce leaves the caller with the same
 * response, because a difference the attacker can see is the whole leak. GoTrue
 * makes this easy to get wrong: `resend` returns `over_email_send_rate_limit` only
 * when there is an unconfirmed account to re-mail, and plain `ok` for an address it
 * has never seen. Measured against a local Supabase, three attempts each:
 *
 *     unknown x1..x3   ok
 *     known   x1..x3   over_email_send_rate_limit / 429
 *
 * So forwarding that one code — which reads as helpful, and which the app's own
 * per-email bucket does not mask, since GoTrue answers differently on the first
 * attempt — is a clean account-existence oracle.
 *
 * Node environment rather than jsdom: these are server modules, and `redirect()`
 * signals success by throwing, so the assertions read the thrown digest.
 */

import { AuthApiError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isActionFailure, type ActionResult } from "@/components/shared/form";
import type * as RequestModule from "@/lib/request";
import { routes } from "@/lib/routes";

const resend = vi.fn();
const resetPasswordForEmail = vi.fn();
const enforceRateLimit = vi.fn();

vi.mock("@/services/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { resend, resetPasswordForEmail } }),
  getCurrentUser: async () => null,
}));

// Allowed throughout: our own buckets are not what is under test, and a denial
// would short-circuit before GoTrue is ever called.
vi.mock("@/services/rate-limit", () => ({
  enforceRateLimit: (...args: unknown[]) => enforceRateLimit(...args),
  rateLimitMessage: () => "Too many attempts. Wait a few minutes and try again.",
}));

vi.mock("@/services/supabase/admin", () => ({ logActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// `getRequestContext` reads `next/headers`, which needs a request scope. No IP is
// also the local case, where there is no proxy to set the header.
vi.mock("@/lib/request", async (importOriginal) => ({
  ...(await importOriginal<typeof RequestModule>()),
  getRequestContext: async () => ({ ip: null, userAgent: null }),
}));

const { requestPasswordResetAction, resendVerificationAction } = await import("./auth-actions");

/**
 * A real `AuthApiError`, not an object shaped like one: `authErrorMessage`
 * narrows with `instanceof`, so a plain literal would collapse to the generic
 * message through the wrong branch and prove nothing about the mapping.
 */
function authApiError(code: string, status: number, message: string): AuthApiError {
  return new AuthApiError(message, status, code);
}

/** What GoTrue answers when there is an unconfirmed account it just mailed. */
const SEND_THROTTLED = {
  error: authApiError(
    "over_email_send_rate_limit",
    429,
    "For security purposes, you can only request this after 60 seconds.",
  ),
};

/** What GoTrue returns for an address it has no account for: nothing at all. */
const SENT = { error: null };

/**
 * The path a thrown `redirect()` carries, read the way Next reads it —
 * `NEXT_REDIRECT;<type>;<url>;<status>;` — rather than by calling the framework's
 * own parser, which is not part of `next/navigation`'s public surface. A digest
 * format change fails here instead of silently making every comparison below pass.
 */
function redirectPath(error: unknown): string | null {
  const digest = (error as { digest?: unknown }).digest;

  if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT;")) {
    return null;
  }

  return digest.split(";").slice(2, -2).join(";");
}

/**
 * The response an unauthenticated caller can observe, reduced to the one thing
 * they can compare between two addresses: where they end up, or what they are
 * told. Anything that differs here is the oracle.
 */
async function observe(run: () => Promise<ActionResult | void>): Promise<string> {
  try {
    const result = await run();

    return isActionFailure(result) ? `error:${result.error}` : `returned:${JSON.stringify(result)}`;
  } catch (error) {
    const url = redirectPath(error);

    if (url === null) {
      throw error;
    }

    return `redirect:${url}`;
  }
}

beforeEach(() => {
  enforceRateLimit.mockResolvedValue({ allowed: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("resendVerificationAction", () => {
  it("answers a throttled send exactly as it answers a delivered one", async () => {
    resend.mockResolvedValueOnce(SENT);
    const unknownAddress = await observe(() =>
      resendVerificationAction({ email: "nobody@x.test" }),
    );

    resend.mockResolvedValueOnce(SEND_THROTTLED);
    const knownAddress = await observe(() => resendVerificationAction({ email: "nobody@x.test" }));

    expect(knownAddress).toBe(unknownAddress);
    expect(knownAddress).toBe(
      `redirect:${routes.verifyEmail}?email=${encodeURIComponent("nobody@x.test")}&sent=1`,
    );
  });

  it("keeps every other provider failure invisible too", async () => {
    resend.mockResolvedValueOnce(SENT);
    const delivered = await observe(() => resendVerificationAction({ email: "a@x.test" }));

    resend.mockResolvedValueOnce({
      error: authApiError("user_already_exists", 422, "User already registered"),
    });

    expect(await observe(() => resendVerificationAction({ email: "a@x.test" }))).toBe(delivered);
  });

  it("still rejects an address the schema does not accept", async () => {
    // The uniform answer is for addresses we tried to mail. A malformed one was
    // never sent anywhere, so saying so reveals nothing about any account.
    const result = await resendVerificationAction({ email: "not-an-email" });

    expect(isActionFailure(result)).toBe(true);
    expect(resend).not.toHaveBeenCalled();
  });
});

describe("requestPasswordResetAction", () => {
  it("answers a throttled send exactly as it answers a delivered one", async () => {
    resetPasswordForEmail.mockResolvedValueOnce(SENT);
    const delivered = await observe(() => requestPasswordResetAction({ email: "a@x.test" }));

    resetPasswordForEmail.mockResolvedValueOnce(SEND_THROTTLED);
    const throttled = await observe(() => requestPasswordResetAction({ email: "a@x.test" }));

    expect(throttled).toBe(delivered);
    expect(throttled).toBe(`redirect:${routes.forgotPassword}?sent=1`);
  });

  it("reports our own rate limit, which does not depend on the account", async () => {
    // A per-email bucket fills the same way for an address with no account, so the
    // message carries no signal — and suppressing it would leave the user with a
    // "check your inbox" for a mail that was never sent.
    enforceRateLimit.mockResolvedValue({ allowed: false, reason: "limited" });

    const result = await requestPasswordResetAction({ email: "a@x.test" });

    expect(isActionFailure(result)).toBe(true);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
