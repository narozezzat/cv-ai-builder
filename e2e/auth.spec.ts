import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// Playwright transpiles specs to CommonJS, where `import.meta` is a syntax error.
// Its own config resolves `testDir` against the repo root, so `cwd` is that root.
const repoRoot = process.cwd();

/**
 * Auth entry points.
 *
 * Split into two kinds of test. The structural ones run anywhere, including CI
 * against the placeholder Supabase credentials — they assert markup and
 * client-side validation, neither of which reaches a backend. The submitting ones
 * need a real project and skip without one, the same bargain
 * `services/supabase/rls-isolation.test.ts` makes: a skip means "not proven", not
 * "fine".
 *
 * The submitting test exists for a specific regression. `redirect()` interrupts a
 * Server Action by throwing, so `runAction`'s `catch` sees the router's own
 * success signal; before `unstable_rethrow` guarded it, every redirecting submit
 * set a root form error. Only a redirect back to the *same* route made that
 * visible — the form stays mounted through a soft navigation, so
 * "Something went wrong. Try again in a moment." rendered directly beside
 * "Check your inbox". Any redirect that changed route hid the same bug behind the
 * replaced page, which is why nothing else in the suite would have caught it.
 */

/** The string `runAction` shows when it cannot tell what happened. */
const TRANSPORT_ERROR = "Something went wrong. Try again in a moment.";

/**
 * Whether the app under test is talking to a real Supabase project.
 *
 * Reads `.env.local` because Next loads it for `pnpm build && pnpm start` while
 * the Playwright process itself never sees it — checking only `process.env` would
 * skip these tests on the machine where they can actually run. Parsing is
 * deliberately minimal; the file only holds `KEY=value`.
 */
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;

  try {
    const contents = readFileSync(resolve(repoRoot, ".env.local"), "utf8");

    for (const line of contents.split("\n")) {
      const match = /^\s*([\w.-]+)\s*=\s*(.*)\s*$/.exec(line);

      if (match && !line.trimStart().startsWith("#")) {
        env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
      }
    }
  } catch {
    // Absent in CI. `process.env` alone decides.
  }

  return env;
}

const env = loadEnv();

function hasLiveBackend(): boolean {
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  // The service-role key matters as much as the URL: the rate limiter fails
  // closed without it, so the action would answer "Something went wrong on our
  // end." and never reach the redirect this test is about.
  return Boolean(url) && !url.includes("placeholder") && Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
}

const live = hasLiveBackend();

/** Local Supabase's mail catcher. Absent when pointed at a hosted project. */
const MAILBOX = "http://127.0.0.1:54324";

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  return fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
}

/**
 * A confirmed account, so the recovery mail is actually sent. An address with no
 * account gets the same answer from the form — that is the anti-enumeration
 * property — but no mail, and this test needs the link.
 */
async function createConfirmedUser(email: string): Promise<string> {
  const response = await adminFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password: `E2e-${crypto.randomUUID()}`, email_confirm: true }),
  });

  expect(response.ok, "admin createUser").toBeTruthy();

  return ((await response.json()) as { id: string }).id;
}

/** The verify link from the newest message addressed to `email`, or null. */
async function recoveryLinkFor(email: string): Promise<string | null> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const list = (await (await fetch(`${MAILBOX}/api/v1/messages?limit=20`)).json()) as {
      messages: { ID: string; To: { Address: string }[] }[];
    };
    const hit = list.messages.find((message) =>
      message.To.some((to) => to.Address.toLowerCase() === email.toLowerCase()),
    );

    if (hit) {
      const body = (await (await fetch(`${MAILBOX}/api/v1/message/${hit.ID}`)).json()) as {
        HTML?: string;
        Text?: string;
      };

      return (
        /https?:\/\/[^\s"'<>]*verify[^\s"'<>]*/
          .exec(body.HTML || body.Text || "")?.[0]
          ?.replaceAll("&amp;", "&") ?? null
      );
    }

    await new Promise((wake) => setTimeout(wake, 1000));
  }

  return null;
}

async function mailboxReachable(): Promise<boolean> {
  try {
    return (await fetch(`${MAILBOX}/api/v1/messages?limit=1`)).ok;
  } catch {
    return false;
  }
}

/** Unique per run, so the per-address rate-limit bucket is always empty. */
function throwawayEmail(): string {
  return `e2e-reset-${crypto.randomUUID()}@example.com`;
}

/**
 * A caller IP nobody else has used, for the same reason `throwawayEmail` exists.
 *
 * Password reset consumes two buckets — per address and per IP, 5 an hour each —
 * and a fresh address only empties the first. `next start` does populate
 * `x-forwarded-for` on localhost, so every local run of this suite shares one IP
 * bucket and drains it: three submits a run (both projects reach the last test),
 * tripled again by `CI=1` retries. The limiter then refuses, correctly, and the
 * submit under test never redirects — a red test that says nothing about the code
 * it guards. Varying the header per run is spoofing the limiter cannot prevent and
 * does not try to: it trusts the header only because Vercel overwrites it at the
 * edge, which is exactly why the production bucket is not forgeable this way.
 */
function throwawayForwardedFor(): string {
  const octet = () => Math.floor(Math.random() * 256);

  // Private space, three random octets: 16M keys, so two runs sharing a bucket is
  // not a thing that happens, and no real client address is ever impersonated.
  return `10.${octet()}.${octet()}.${octet()}`;
}

async function submitReset(page: Page, email: string): Promise<void> {
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: /send reset link/i }).click();
}

test.describe("forgot password", () => {
  test("renders the form and its way back to sign in", async ({ page }) => {
    await page.goto("/forgot-password");

    await expect(
      page.getByRole("heading", { level: 1, name: /reset your password/i }),
    ).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /back to sign in/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  test("rejects a malformed address without contacting the server", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email", { exact: true }).fill("not-an-address");
    await page.getByRole("button", { name: /send reset link/i }).click();

    await expect(page.getByText(/enter a valid email address/i)).toBeVisible();
    await expect(page).toHaveURL(/\/forgot-password$/);
  });

  // chromium only: one submit per run keeps the per-address budget out of the way,
  // and a second project would only double the mail this test has to sift through.
  test.describe(() => {
    test.skip(!live, "needs a real Supabase project and service-role key");

    // Fresh per-IP bucket, so a rerun inside the hour is not refused by the
    // limiter before it reaches the redirect under test. See
    // `throwawayForwardedFor`.
    test.use({ extraHTTPHeaders: { "x-forwarded-for": throwawayForwardedFor() } });

    /**
     * One submit, two regressions.
     *
     * The address is a real confirmed account so the mail is actually sent, which
     * buys the second half: following the link. Both halves share one submit — a
     * second would only add a second mail to disambiguate, and the fix being
     * guarded here is precisely about what happens *after* the mail is sent.
     */
    test("confirms a submitted address, then lands its link on the reset form", async ({
      page,
      browserName,
    }) => {
      test.skip(browserName !== "chromium", "one submit per run; see the note above");

      const email = throwawayEmail();
      const userId = await createConfirmedUser(email);

      try {
        await submitReset(page, email);

        await expect(page).toHaveURL(/\/forgot-password\?sent=1$/);
        await expect(page.getByText(/check your inbox/i)).toBeVisible();

        // The first regression. The banner appearing is not enough — the bug put
        // the error next to it, on the same screen, at the same time.
        await expect(page.getByText(TRANSPORT_ERROR)).toHaveCount(0);

        if (!(await mailboxReachable())) {
          test.info().annotations.push({
            type: "partial",
            description: "no local mail catcher — the recovery link was not followed",
          });

          return;
        }

        /**
         * The second regression, and the reason `flow=recovery` exists. GoTrue's
         * PKCE redirect drops the `type` parameter, so `/auth/callback` had nothing
         * left to recognise a recovery by and sent the user to the dashboard with a
         * live session and no way to set a password. Only a real round-trip through
         * real mail reproduces that — the callback's own tests cannot see which
         * parameters GoTrue chooses to forward.
         */
        const link = await recoveryLinkFor(email);
        expect(link, "recovery mail").not.toBeNull();

        await page.goto(link!);

        await expect(page).toHaveURL(/\/reset-password$/);
        await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
      } finally {
        await adminFetch(`/admin/users/${userId}`, { method: "DELETE" });
      }
    });
  });

  test("never reports a transport failure for a well-formed submit", async ({ page }) => {
    // Runs without a backend too. Whatever the server decides — sent, rate
    // limited, limiter unavailable — none of those outcomes is the framework
    // signal `runAction` used to mistake for one, so this string is always wrong
    // here.
    await submitReset(page, throwawayEmail());
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(TRANSPORT_ERROR)).toHaveCount(0);
  });
});
