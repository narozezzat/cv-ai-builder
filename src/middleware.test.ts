/**
 * @vitest-environment node
 *
 * Middleware runs on the edge, not in a DOM, and these tests build real
 * `NextRequest` objects — jsdom's `Request` is not the one `next/server` expects.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as SupabaseMiddlewareModule from "@/services/supabase/middleware";

const getUser = vi.fn();

// Only the client factory is faked. `hasAuthCookie` and the deadline around
// `getUser()` are the behaviour under test, so they come from the real module.
vi.mock("@/services/supabase/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof SupabaseMiddlewareModule>();
  const { NextResponse } = await import("next/server");

  return {
    ...actual,
    createSupabaseMiddlewareClient: vi.fn(() => ({
      supabase: { auth: { getUser } },
      response: NextResponse.next(),
    })),
  };
});

const { NextRequest } = await import("next/server");
const { middleware } = await import("./middleware");
const { AUTH_LOOKUP_BUDGET_MS } = await import("@/services/supabase/middleware");

/** A session cookie shaped like the one `@supabase/ssr` writes. */
const AUTH_COOKIE = "sb-abcdefghijklmnop-auth-token";

function request(pathname: string, { signedIn = false } = {}) {
  const req = new NextRequest(new URL(pathname, "https://reforge.app"));

  if (signedIn) {
    req.cookies.set(AUTH_COOKIE, "base64-whatever");
  }

  return req;
}

beforeEach(() => {
  getUser.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("middleware", () => {
  it("never asks Supabase about a visitor who carries no session cookie", async () => {
    const response = await middleware(request("/"));

    expect(getUser).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("sends a cookieless visitor away from a protected route without a round-trip", async () => {
    const response = await middleware(request("/dashboard/resumes"));

    expect(getUser).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://reforge.app/login?next=%2Fdashboard%2Fresumes",
    );
  });

  it("gives up on a hung auth lookup instead of running past the platform's limit", async () => {
    vi.useFakeTimers();
    // Supabase's own refresh path retries with backoff for up to 30s — longer
    // than Vercel gives the whole middleware invocation. A promise that never
    // settles stands in for that.
    getUser.mockReturnValue(new Promise(() => {}));

    const pending = middleware(request("/dashboard", { signedIn: true }));
    await vi.advanceTimersByTimeAsync(AUTH_LOOKUP_BUDGET_MS);

    const response = await pending;

    // Passed through, not bounced to login: a cookie was present, so the visitor
    // most likely has a session, and `requireUser()` in the layout is the guard
    // that actually decides.
    expect(response.status).toBe(200);
    expect(AUTH_LOOKUP_BUDGET_MS).toBeLessThan(25_000);
  });

  it("passes through when the auth endpoint is unreachable", async () => {
    const error = new Error("fetch failed");
    error.name = "AuthRetryableFetchError";
    getUser.mockResolvedValue({ data: { user: null }, error });

    const response = await middleware(request("/dashboard", { signedIn: true }));

    expect(response.status).toBe(200);
  });

  it("still bounces a signed-out cookie holder off a protected route", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing!" },
    });

    const response = await middleware(request("/builder/abc", { signedIn: true }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://reforge.app/login?next=%2Fbuilder%2Fabc",
    );
  });

  it("still bounces a signed-in user off the login page", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const response = await middleware(request("/login", { signedIn: true }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://reforge.app/dashboard");
  });
});
