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
 * SECURITY: the redirects are usability, not authorization. Middleware can be
 * skipped by anything that talks to Supabase directly with the anon key — which is
 * public — so it must never be the only thing standing between a request and data.
 * The actual guarantee is RLS (`supabase/migrations/20260726090200_rls.sql`); this
 * file only decides which page renders.
 */

import { NextResponse, type NextRequest } from "next/server";

import { AUTH_ROUTES, isProtectedPath, NEXT_PARAM, routes } from "@/lib/routes";
import { copyAuthCookies, createSupabaseMiddlewareClient } from "@/services/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(request);

  // `getUser()`, not `getSession()`. The latter decodes the cookie without
  // verifying it, so it would accept a forged one — and it does not trigger the
  // refresh that is half the point of this middleware.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = routes.login;
    url.search = "";
    // Path plus query only, never an absolute URL. Written here but re-validated
    // on the way out by `safeRedirectPath`, because the value that reaches the
    // login action may just as easily have come from an attacker's link — a
    // `next` accepting arbitrary origins is an open redirect that phishes
    // through our own domain.
    url.searchParams.set(NEXT_PARAM, `${pathname}${search}`);

    return copyAuthCookies(response, NextResponse.redirect(url));
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
