/**
 * The single landing point for every credential that arrives in a URL: OAuth
 * returns, signup confirmations, magic links, and password recovery.
 *
 * It exists as a route handler rather than a page because it has to *write*
 * cookies. Exchanging a code for a session sets the auth cookies, and a Server
 * Component cannot set them — so a page here would verify the token, drop the
 * session on the floor, and render a signed-out screen.
 *
 * Excluded from the middleware matcher (`auth/` in its negative lookahead): the
 * middleware refreshes sessions, and running a refresh against a request whose
 * whole purpose is to *create* one races with the exchange.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { callbackTargets, otpType } from "@/features/auth";
import { createSupabaseServerClient } from "@/services/supabase/server";

/**
 * Sends the user back to a form, carrying the reason as a code.
 *
 * SECURITY: `error_code` only — never `error_description`. The provider's
 * description is attacker-influenced text, and reflecting it onto our own login
 * page would let anyone publish a message of their choosing on our domain,
 * complete with a genuine padlock. The code is looked up against a table we own
 * (`callbackErrorMessage`) and anything unrecognized becomes generic copy.
 */
function failure(path: string, code: string | null): never {
  const params = new URLSearchParams();

  if (code) {
    params.set("error_code", code);
  }

  const query = params.toString();

  redirect(query ? `${path}?${query}` : path);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const type = otpType(params.get("type"));
  const tokenHash = params.get("token_hash");
  const code = params.get("code");

  const { destination, errorPath } = callbackTargets(params);

  // The provider refused before we ever saw a token — a cancelled OAuth consent
  // screen, or an expired link that GoTrue rejected at the redirect.
  const providerError = params.get("error") ?? params.get("error_code");

  if (providerError) {
    failure(errorPath, params.get("error_code") ?? providerError);
  }

  const supabase = await createSupabaseServerClient();

  if (code) {
    // PKCE: the verifier is in an httpOnly cookie this request carries, which is
    // what binds the code to this browser.
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      failure(errorPath, error.code ?? null);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (error) {
      failure(errorPath, error.code ?? null);
    }
  } else {
    // Neither credential present. Someone opened the route directly, or a mail
    // client rewrote the link and dropped the query string.
    failure(errorPath, "flow_state_not_found");
  }

  // The session changed, so anything rendered against the old one is stale — the
  // nav's signed-in state most visibly. Layout-level so the whole tree re-renders
  // rather than only the destination segment.
  revalidatePath("/", "layout");

  redirect(destination);
}
