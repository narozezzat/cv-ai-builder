import { describe, expect, it } from "vitest";

import { hasRecoveryAuthority, RECOVERY_AUTHORITY_WINDOW_SECONDS } from "./recovery-session";

const now = 1_760_000_000;
const fresh = now - 60;
const stale = now - RECOVERY_AUTHORITY_WINDOW_SECONDS - 1;

/**
 * SECURITY: this predicate is the authorization for setting a password without
 * knowing the old one. `amr` is the only claim that says how a session was minted,
 * and it survives refresh-token rotation for the session's whole life — so a
 * timestamp inside the window is as load-bearing as the method itself. Everything
 * it cannot prove is a denial.
 */
describe("hasRecoveryAuthority", () => {
  it("accepts a session minted by a recovery link", () => {
    expect(hasRecoveryAuthority({ amr: [{ method: "recovery", timestamp: fresh }] }, now)).toBe(
      true,
    );
  });

  it("accepts an otp-verified recovery, which is what the implicit flow reports", () => {
    expect(hasRecoveryAuthority({ amr: [{ method: "otp", timestamp: fresh }] }, now)).toBe(true);
  });

  it("refuses an ordinary password session", () => {
    expect(hasRecoveryAuthority({ amr: [{ method: "password", timestamp: fresh }] }, now)).toBe(
      false,
    );
  });

  it("refuses an oauth session", () => {
    expect(hasRecoveryAuthority({ amr: [{ method: "oauth", timestamp: fresh }] }, now)).toBe(false);
  });

  it("refuses a recovery older than the window, since amr outlives the link", () => {
    expect(hasRecoveryAuthority({ amr: [{ method: "recovery", timestamp: stale }] }, now)).toBe(
      false,
    );
  });

  it("refuses a timestamp in the future", () => {
    expect(hasRecoveryAuthority({ amr: [{ method: "recovery", timestamp: now + 120 }] }, now)).toBe(
      false,
    );
  });

  /**
   * The RFC-8176 string form carries no timestamp, so it cannot be shown to be
   * recent. Fail closed rather than treating "recovery, at some unknown time" as
   * authority.
   */
  it("refuses the string amr form, which has no timestamp to check", () => {
    expect(hasRecoveryAuthority({ amr: ["recovery"] }, now)).toBe(false);
  });

  it("refuses claims with no amr at all", () => {
    expect(hasRecoveryAuthority({}, now)).toBe(false);
    expect(hasRecoveryAuthority({ amr: [] }, now)).toBe(false);
  });

  it("accepts when a recovery entry sits beside other methods", () => {
    expect(
      hasRecoveryAuthority(
        {
          amr: [
            { method: "password", timestamp: stale },
            { method: "recovery", timestamp: fresh },
          ],
        },
        now,
      ),
    ).toBe(true);
  });
});
