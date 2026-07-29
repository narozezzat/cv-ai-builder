import { expect, test } from "@playwright/test";

/**
 * `/print/[token]` is the one route in the app authorized by a signed capability instead of
 * a session, because headless Chromium navigates with no cookies. That makes it the route
 * where a mistake is worth the most: it renders a resume to whoever holds the URL.
 *
 * These are the assertions that need no authenticated fixture — every one of them is a
 * request nobody should be able to make. They test the refusal, not the render.
 *
 * Chromium only: this is response-level behaviour, identical in every engine, and the
 * middleware path it exercises is not browser-dependent.
 */
test.describe("print route", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Response-level checks.");

  /*
    Each of these fails at a different place — a malformed shape before any crypto runs, a
    well-formed token with a wrong signature at the HMAC compare, a plausible-looking
    base64url payload at the parse — and every one of them must answer identically. A 400
    for the malformed one and a 404 for the forged one would tell an attacker which half of
    the token to keep working on.
  */
  /** A structurally perfect `v1` payload — far-future expiry, real uuids, no valid signature. */
  const wellFormedPayload = Buffer.from(
    JSON.stringify({
      r: "00000000-0000-4000-8000-000000000001",
      u: "00000000-0000-4000-8000-000000000002",
      e: 4_102_444_800,
    }),
  ).toString("base64url");

  const rejected = [
    { name: "a garbage token", token: "not-a-token" },
    { name: "an empty-ish token", token: "%20" },
    { name: "a token with no signature", token: `v1.${wellFormedPayload}` },
    // 32 zero bytes: the right length for an HMAC-SHA256 digest, so this reaches
    // `timingSafeEqual` rather than being turned away by the length check.
    {
      name: "a forged signature",
      token: `v1.${wellFormedPayload}.${Buffer.alloc(32).toString("base64url")}`,
    },
    { name: "an unknown token version", token: `v2.${wellFormedPayload}.AAAA` },
    { name: "a path traversal attempt", token: "..%2F..%2Fdashboard" },
  ];

  for (const { name, token } of rejected) {
    test(`${name} is answered with 404, not an error`, async ({ request }) => {
      const response = await request.get(`/print/${token}`, { maxRedirects: 0 });

      // 404 exactly: a 500 would advertise a half-configured deployment and a 3xx would
      // mean middleware had started treating this as a protected route, which would break
      // every export instead of blocking anything.
      expect(response.status()).toBe(404);
    });
  }

  test("the route is not protected by middleware", async ({ request }) => {
    // Regression guard for the least obvious thing about this route: adding "/print" to
    // PROTECTED_PREFIXES looks like hardening and silently breaks all exports, because the
    // browser doing the rendering has no session to redirect back into.
    const response = await request.get("/print/not-a-token", { maxRedirects: 0 });

    expect(response.status()).not.toBe(307);
    expect(response.headers().location).toBeUndefined();
  });

  test("a rejected print URL renders the app's own 404 page", async ({ page }) => {
    // Not a raw Next error screen: the print route calls `notFound()`, so the refusal has
    // to come back through the normal not-found boundary with a main landmark on it.
    const response = await page.goto("/print/not-a-token");

    expect(response?.status()).toBe(404);
    await expect(page.locator("main#main")).toBeVisible();
  });
});
