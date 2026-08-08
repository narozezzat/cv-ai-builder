/**
 * Edge middleware: session refresh and route guards.
 *
 * Two jobs, in this order.
 *
 * 1. **Refresh the session.** Supabase access tokens are short-lived. Calling
 *    `getUser()` here rotates them and writes the new cookies onto the outgoing
 *    response, so Server Components — which cannot write cookies — always see a
 *    valid session. Without this, users get logged out roughly hourly.
 *
 * 2. **Redirect.** Signed-out visitors heading for `(dashboard)` go to login;
 *    signed-in users heading for login/signup go to the dashboard.
 *
 * Both jobs are bounded. Middleware sits in front of nearly every route, so any
 * time it spends waiting on Supabase is time every page waits — and if it spends
 * more than the platform allows, the result is not a slow page but a 504 on the
 * whole site. So: no network at all when the request carries no session cookie,
 * and a hard deadline on the lookup when it does.
 *
 * SECURITY: the redirects are usability, not authorization. Middleware can be
 * skipped by anything that talks to Supabase directly with the anon key — which is
 * public — so it must never be the only thing standing between a request and data.
 * The actual guarantee is RLS (`supabase/migrations/20260726090200_rls.sql`); this
 * file only decides which page renders.
 */

import { NextResponse, type NextRequest } from "next/server";

import { AUTH_ROUTES, isProtectedPath, NEXT_PARAM, routes } from "@/lib/routes";
import {
  copyAuthCookies,
  createSupabaseMiddlewareClient,
  getUserWithDeadline,
  hasAuthCookie,
} from "@/services/supabase/middleware";

/**
 * Builds the redirect to login.
 *
 * The `next` value is path plus query only, never an absolute URL. Written here
 * but re-validated on the way out by `safeRedirectPath`, because the value that
 * reaches the login action may just as easily have come from an attacker's link
 * — a `next` accepting arbitrary origins is an open redirect that phishes
 * through our own domain.
 */
function redirectToLogin(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const url = request.nextUrl.clone();

  url.pathname = routes.login;
  url.search = "";
  url.searchParams.set(NEXT_PARAM, `${pathname}${search}`);

  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // No session cookie means there is no session to refresh and no user to look
  // up, so the answer is known without talking to Supabase at all. Most traffic
  // takes this branch, and it is the branch an auth outage cannot touch.
  if (!hasAuthCookie(request)) {
    return isProtectedPath(pathname) ? redirectToLogin(request) : NextResponse.next();
  }

  const { supabase, response } = createSupabaseMiddlewareClient(request);

  // `getUser()`, not `getSession()`. The latter decodes the cookie without
  // verifying it, so it would accept a forged one — and it does not trigger the
  // refresh that is half the point of this middleware. Wrapped in a deadline
  // because the refresh path retries for longer than the platform will wait; see
  // `AUTH_LOOKUP_BUDGET_MS`.
  const { user, reachable } = await getUserWithDeadline(supabase);

  // The auth endpoint never answered. A cookie is present, so this visitor
  // probably does have a session, and bouncing them to login would sign the
  // whole userbase out over a transient blip. Let the request through: the
  // redirects here are usability, and `requireUser()` in the `(app)` layout is
  // what actually decides whether a signed-in page renders.
  if (!reachable) {
    return response;
  }

  if (!user && isProtectedPath(pathname)) {
    return copyAuthCookies(response, redirectToLogin(request));
  }

  if (user && (AUTH_ROUTES as readonly string[]).includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = routes.dashboard;
    url.search = "";

    return copyAuthCookies(response, NextResponse.redirect(url));
  }

  // Must be this exact object — it carries the refreshed cookies.
  return response;
}

export const config = {
  matcher: [
    /**
     * Everything except:
     *
     * - `_next/*` and static assets — no session to refresh, and paying an auth
     *   round-trip per image is measurable.
     * - `/print/*` — the PDF pipeline's render target. Authorized by a signed
     *   token, deliberately session-free, and on the critical path of every
     *   export.
     * - `/r/*` — public share pages. Anonymous by design and crawled by bots, so
     *   a refresh attempt there is pure latency.
     * - `/auth/*` — the OAuth and email-confirmation callbacks run their own code
     *   exchange, which writes its own cookies. Refreshing underneath that is at
     *   best redundant and at worst a race on the same cookie.
     */
    "/((?!_next/static|_next/image|print/|r/|auth/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|ttf|txt|xml|webmanifest)$).*)",
  ],
};
