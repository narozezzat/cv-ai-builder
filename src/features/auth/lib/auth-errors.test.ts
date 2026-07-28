import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_UNREACHABLE_ERROR,
  authErrorMessage,
  GENERIC_AUTH_ERROR,
} from "@/features/auth/lib/auth-errors";

/**
 * These are security tests as much as behaviour tests: the point of the mapper is
 * that an unknown address and a wrong password answer identically, and that no
 * provider text reaches the page. The logging assertions exist because the
 * generic message hid a real production outage — a build pointed at the wrong
 * Supabase project fails with `401 Invalid API key`, which carries no
 * `error_code`, and without the log there is nothing anywhere to distinguish it
 * from someone fat-fingering their password.
 */
describe("authErrorMessage", () => {
  let logged: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logged = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logged.mockRestore();
  });

  it("maps a known code to its message and stays quiet", () => {
    const error = new AuthApiError("Invalid login credentials", 400, "invalid_credentials");

    expect(authErrorMessage(error)).toBe("Email or password is incorrect.");
    expect(logged).not.toHaveBeenCalled();
  });

  it("never leaks which half of the credentials was wrong", () => {
    const unknownUser = new AuthApiError("Invalid login credentials", 400, "invalid_credentials");
    const wrongPassword = new AuthApiError("Invalid login credentials", 400, "invalid_credentials");

    expect(authErrorMessage(unknownUser)).toBe(authErrorMessage(wrongPassword));
  });

  it("collapses an unmapped code to the generic message and logs it", () => {
    const error = new AuthApiError("Database error granting user", 500, "unexpected_failure");

    expect(authErrorMessage(error)).toBe(GENERIC_AUTH_ERROR);
    expect(logged).toHaveBeenCalledWith(
      "[auth] unhandled provider failure",
      expect.objectContaining({ reason: "unmapped-code", code: "unexpected_failure", status: 500 }),
    );
  });

  it("logs a code-less rejection — this is what a wrong anon key looks like", () => {
    const error = new AuthApiError("Invalid API key", 401, undefined);

    expect(authErrorMessage(error)).toBe(GENERIC_AUTH_ERROR);
    expect(logged).toHaveBeenCalledWith(
      "[auth] unhandled provider failure",
      expect.objectContaining({ reason: "no-code", status: 401, message: "Invalid API key" }),
    );
  });

  it("tells the user a fetch failure is a fetch failure", () => {
    const error = new AuthRetryableFetchError("fetch failed", 0);

    expect(authErrorMessage(error)).toBe(AUTH_UNREACHABLE_ERROR);
    expect(logged).toHaveBeenCalledWith(
      "[auth] unhandled provider failure",
      expect.objectContaining({ reason: "unreachable" }),
    );
  });

  it("does not reflect provider text for a non-Auth error", () => {
    expect(authErrorMessage(new Error("connection to db-1.internal:5432 refused"))).toBe(
      GENERIC_AUTH_ERROR,
    );
    expect(authErrorMessage("boom")).toBe(GENERIC_AUTH_ERROR);
  });
});
