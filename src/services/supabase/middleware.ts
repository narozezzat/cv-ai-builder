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
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env/public";
import type { Database } from "@/types/database";

export function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
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
