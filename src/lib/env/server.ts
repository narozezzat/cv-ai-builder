import "server-only";

import { z } from "zod";

import { withoutBlanks } from "./blank";

/**
 * Server-only environment variables.
 *
 * `import "server-only"` makes an accidental client import a build error rather
 * than a leaked service-role key. That guard is the entire reason this is a
 * separate module from `public.ts`.
 *
 * Optional values are optional on purpose: the app must boot and be developed
 * without an OpenAI key or OAuth credentials. Each consumer checks for its own
 * dependency and degrades — see `isAiConfigured` / `isOAuthConfigured` — so a
 * missing key disables one feature instead of taking down the process.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /**
   * Bypasses RLS entirely. Only ever used by `services/supabase/admin.ts` for
   * writes the user must not be able to forge (usage metering, audit logs).
   */
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20, "SUPABASE_SERVICE_ROLE_KEY looks truncated.")
    .optional(),

  /** Signs the short-lived tokens the PDF renderer accepts. */
  EXPORT_TOKEN_SECRET: z
    .string()
    .min(32, "EXPORT_TOKEN_SECRET must be at least 32 characters.")
    .optional(),

  /**
   * Google is the default because it is the only one of the three with a real
   * free tier, which is what the project needs for development and for users who
   * never upgrade. `.env.example` ships `google`; keep the two in step — a value
   * this enum rejects fails the build at page-data collection, not at first use.
   */
  AI_PROVIDER: z.enum(["google", "openai", "anthropic"]).default("google"),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(20).optional(),
  OPENAI_API_KEY: z.string().startsWith("sk-", "OPENAI_API_KEY must start with 'sk-'.").optional(),
  ANTHROPIC_API_KEY: z.string().min(20).optional(),

  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
});

const parsed = serverEnvSchema.safeParse(withoutBlanks(process.env));

if (!parsed.success) {
  throw new Error(`Invalid server environment variables:\n${z.prettifyError(parsed.error)}`);
}

export const serverEnv = parsed.data;

/**
 * True when the configured AI provider actually has a key.
 *
 * Checks only the *configured* provider: holding an OpenAI key while
 * `AI_PROVIDER=google` is not a working setup, and reporting it as one would move
 * the failure from a disabled button to a 401 mid-generation.
 */
export function isAiConfigured(): boolean {
  switch (serverEnv.AI_PROVIDER) {
    case "anthropic":
      return Boolean(serverEnv.ANTHROPIC_API_KEY);
    case "openai":
      return Boolean(serverEnv.OPENAI_API_KEY);
    default:
      return Boolean(serverEnv.GOOGLE_GENERATIVE_AI_API_KEY);
  }
}

/**
 * True when the service-role key is present.
 *
 * Read by anything whose fallback depends on *why* a privileged write is
 * unavailable. `consumeRateLimit` fails closed on error, which is right for a
 * database that is misbehaving but wrong for a checkout with no key configured:
 * that would deny every login attempt and read as "too many attempts".
 */
export function isServiceRoleConfigured(): boolean {
  return Boolean(serverEnv.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Social sign-in is feature-flagged on credential presence so the login screen
 * never renders a button that leads to a Supabase provider error.
 */
export function isOAuthConfigured(provider: "google" | "github"): boolean {
  return provider === "google"
    ? Boolean(serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET)
    : Boolean(serverEnv.GITHUB_CLIENT_ID && serverEnv.GITHUB_CLIENT_SECRET);
}

/**
 * Throws with an actionable message instead of letting an undefined key reach
 * an SDK, where it surfaces as a 401 from a third party.
 */
export function requireServerEnv<K extends keyof typeof serverEnv>(
  key: K,
): NonNullable<(typeof serverEnv)[K]> {
  const value = serverEnv[key];

  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable ${key}. See .env.example.`);
  }

  return value as NonNullable<(typeof serverEnv)[K]>;
}
