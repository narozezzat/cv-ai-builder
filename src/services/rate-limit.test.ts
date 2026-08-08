/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const consumeRateLimit = vi.fn();
const isServiceRoleConfigured = vi.fn();
const serverEnv = { NODE_ENV: "development" as string };

vi.mock("./supabase/admin", () => ({ consumeRateLimit }));
vi.mock("@/lib/env/server", () => ({
  isServiceRoleConfigured,
  get serverEnv() {
    return serverEnv;
  },
}));

const { enforceRateLimit, rateLimitMessage } = await import("./rate-limit");

const RULE = { action: "sign-in", window: "1 minute", max: 5 };

beforeEach(() => {
  consumeRateLimit.mockReset();
  isServiceRoleConfigured.mockReturnValue(true);
  serverEnv.NODE_ENV = "development";
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("enforceRateLimit", () => {
  it("allows a caller who is under the limit", async () => {
    consumeRateLimit.mockResolvedValue("allowed");

    await expect(enforceRateLimit(RULE, "user:1")).resolves.toEqual({ allowed: true });
  });

  it("denies a caller who is over the limit", async () => {
    consumeRateLimit.mockResolvedValue("limited");

    await expect(enforceRateLimit(RULE, "user:1")).resolves.toEqual({
      allowed: false,
      reason: "limited",
    });
  });

  // The bug this test exists for: an unreachable database denied every request
  // and every caller reported it as "too many attempts", so a total outage was
  // indistinguishable from normal throttling.
  it("denies but reports unavailable when the limiter cannot reach the database", async () => {
    consumeRateLimit.mockResolvedValue("unavailable");

    await expect(enforceRateLimit(RULE, "user:1")).resolves.toEqual({
      allowed: false,
      reason: "unavailable",
    });
  });

  it("treats a production deployment with no service-role key as unavailable, not limited", async () => {
    isServiceRoleConfigured.mockReturnValue(false);
    serverEnv.NODE_ENV = "production";

    await expect(enforceRateLimit(RULE, "user:1")).resolves.toEqual({
      allowed: false,
      reason: "unavailable",
    });
    expect(consumeRateLimit).not.toHaveBeenCalled();
  });

  it("skips the limit outside production when no service-role key is set", async () => {
    isServiceRoleConfigured.mockReturnValue(false);

    await expect(enforceRateLimit(RULE, "user:1")).resolves.toEqual({ allowed: true });
    expect(consumeRateLimit).not.toHaveBeenCalled();
  });
});

describe("rateLimitMessage", () => {
  it("blames the caller only when the caller is actually at fault", () => {
    expect(rateLimitMessage("limited")).toMatch(/too many/i);
    expect(rateLimitMessage("unavailable")).not.toMatch(/too many/i);
  });

  it("says nothing about how long to wait, in either case", () => {
    // A countdown is a rate limiter telling an attacker exactly when to resume.
    expect(rateLimitMessage("limited")).not.toMatch(/\d/);
    expect(rateLimitMessage("unavailable")).not.toMatch(/\d/);
  });
});
