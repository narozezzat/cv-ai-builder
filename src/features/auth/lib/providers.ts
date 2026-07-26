import "server-only";

import { isOAuthConfigured } from "@/lib/env/server";

import { OAUTH_PROVIDERS, type OAuthProvider } from "../schema/auth-schema";

/**
 * The social providers that actually have credentials.
 *
 * Computed on the server and handed to `<OAuthButtons>` as data, so a provider
 * without a client secret renders no button at all rather than a button that leads
 * to a Supabase provider error. Iterating `OAUTH_PROVIDERS` rather than the env
 * keys keeps the order canonical, which is what makes button positions stable.
 */
export function configuredOAuthProviders(): OAuthProvider[] {
  return OAUTH_PROVIDERS.filter((provider) => isOAuthConfigured(provider));
}
