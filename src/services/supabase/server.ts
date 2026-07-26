/**
 * Server Supabase client, bound to the request's cookies.
 *
 * Still the anon key, still fully subject to RLS. What it adds over the browser
 * client is the caller's session, read from cookies, so `auth.uid()` is populated
 * inside policies and definer functions. It is not a privileged client — that is
 * `admin.ts`.
 *
 * `import "server-only"` so an accidental import from a client component fails at
 * build time rather than shipping `next/headers` to the browser.
 */

import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env/public";
import { routes } from "@/lib/routes";
import type { Database } from "@/types/database";

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Server Components cannot write cookies; Next throws if you try. The
          // refresh that wanted to write here already happened in middleware,
          // where the response is mutable, so swallowing this is correct rather
          // than lossy. Server Actions and Route Handlers *can* write, and do.
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Read-only cookie store — see above.
          }
        },
      },
    },
  );
}

/**
 * The current user, or null.
 *
 * Deliberately `getUser()` and not `getSession()`. `getSession()` decodes the JWT
 * out of the cookie without verifying it, so a forged cookie yields a plausible
 * user object; `getUser()` validates against the auth server. Anywhere the answer
 * gates access, it has to be the verified one.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    // An expired or absent session is the normal case for a signed-out visitor,
    // not an exception worth propagating.
    return null;
  }

  return data.user;
}

/**
 * The current user, or a redirect to login.
 *
 * For pages and actions whose entire body assumes a session. The redirect is a
 * usability affordance — the row-level guarantee comes from RLS, so forgetting
 * this call leaks nothing, it just renders an empty page instead of a login form.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(routes.login);
  }

  return user;
}
