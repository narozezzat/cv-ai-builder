/**
 * Browser Supabase client.
 *
 * Uses the anon key, which ships in the client bundle by design. The only thing
 * standing between this client and every row in the database is RLS — see
 * `supabase/migrations/20260726090200_rls.sql`. Nothing in this file is a
 * security control.
 *
 * `createBrowserClient` memoizes internally per (url, key), so calling
 * `getSupabaseBrowserClient()` from a dozen components yields one client and one
 * realtime socket rather than a dozen.
 */

import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env/public";
import type { Database } from "@/types/database";

export type SupabaseBrowserClient = ReturnType<typeof getSupabaseBrowserClient>;

export function getSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
