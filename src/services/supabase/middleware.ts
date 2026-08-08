/**
 * Supabase client for the Edge middleware.
 *
 * A third client rather than a reuse of `server.ts` because middleware has no
 * `next/headers` cookie store — it reads from `NextRequest` and writes to a
 * `NextResponse`. The cookie plumbing is the whole difference; the client itself
 * is the same anon-key, RLS-subject client.
 *
 * The response object is returned alongside the client because refreshed auth
 * cookies are written onto *that specific response*. A caller that builds its own
 * `NextResponse` and returns it instead will silently drop the refreshed session,
 * which shows up as a user being logged out every hour — see `copyAuthCookies`.
 */

import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env/public";
import type { Database } from "@/types/database";

/**
 * How long a single call to the auth endpoint may take before it is abandoned.
 *
 * `@supabase/auth-js` sets no timeout of its own, so a request that connects and
 * then stalls hangs for as long as the platform allows.
 */
const AUTH_FETCH_TIMEOUT_MS = 2_000;

/**
 * How long the whole session lookup may take, retries included.
 *
 * This exists because two budgets disagree. When an access token is inside its
 * 90-second expiry margin, `getUser()` refreshes it, and `_refreshAccessToken`
 * retries on network failure with exponential backoff for as long as
 * `AUTO_REFRESH_TICK_DURATION_MS` — 30 seconds. Vercel kills a middleware
 * invocation at 25. So a merely *slow* auth endpoint does not produce a slow
 * page; it produces `MIDDLEWARE_INVOCATION_TIMEOUT`, and because the matcher
 * covers nearly every path, a 504 on the whole site.
 *
 * Three seconds is far below both numbers, which is the point: middleware
 * should decide which page renders, not wait on a remote service to do it.
 */
export const AUTH_LOOKUP_BUDGET_MS = 3_000;

/** What a session lookup concluded, and whether it got to conclude anything. */
export interface AuthLookup {
  user: { id: string } | null;
  /**
   * `false` when the auth endpoint timed out or failed to answer — meaning
   * `user: null` is an absence of information, not a signed-out visitor.
   */
  reachable: boolean;
}

/**
 * The cookie `@supabase/ssr` stores the session in: `sb-<project-ref>-auth-token`,
 * plus `.0`/`.1` suffixes once the value is large enough to be chunked.
 */
const AUTH_COOKIE_PATTERN = /^sb-.+-auth-token(\.\d+)?$/;

/**
 * Whether this request could possibly carry a session.
 *
 * Worth checking before anything else: with no auth cookie there is nothing to
 * refresh and nothing to verify, so the request needs no Supabase client and no
 * network at all. That covers every anonymous visit to the marketing pages and
 * every crawler, which is most traffic — and it means an auth outage cannot
 * reach them.
 */
export function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => AUTH_COOKIE_PATTERN.test(name));
}

/**
 * `getUser()` under a hard deadline.
 *
 * Never rejects and never outlives {@link AUTH_LOOKUP_BUDGET_MS}. A caller that
 * gets `reachable: false` must not treat it as "signed out" — see the callers in
 * `src/middleware.ts`.
 */
export async function getUserWithDeadline(
  supabase: Pick<SupabaseClient<Database>, "auth">,
): Promise<AuthLookup> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<AuthLookup>((resolve) => {
    timer = setTimeout(() => resolve({ user: null, reachable: false }), AUTH_LOOKUP_BUDGET_MS);
  });

  const lookup = supabase.auth
    .getUser()
    .then(({ data, error }) => ({
      user: data.user,
      // `AuthRetryableFetchError` is the one error that means "we never got an
      // answer". Everything else — a missing session, a rejected token — is a
      // real answer and must be acted on.
      reachable: error?.name !== "AuthRetryableFetchError",
    }))
    .catch(() => ({ user: null, reachable: false }));

  try {
    return await Promise.race([lookup, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * `fetch` that abandons a request rather than letting it hang.
 *
 * An `AbortController` instead of `AbortSignal.timeout()` so the behaviour does
 * not depend on which runtime the middleware is compiled for.
 */
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS);

  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { fetch: fetchWithTimeout },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Written to the request too, so anything later in this same middleware
          // pass reads the refreshed value rather than the stale one.
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          response = NextResponse.next({ request });

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  return {
    supabase,
    /** Getter, not a value: `setAll` replaces the response object. */
    get response() {
      return response;
    },
  };
}

/**
 * Moves the refreshed auth cookies from the pass-through response onto a
 * redirect.
 *
 * Required whenever middleware redirects. The refresh already happened during
 * `getUser()`, and the new tokens live only on the response Supabase wrote to; a
 * bare `NextResponse.redirect()` discards them, so the next request arrives with
 * the expired session and redirects again.
 */
export function copyAuthCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }

  return to;
}
