import { z } from "zod";

import { withoutBlanks } from "./blank";

/**
 * Environment variables that are safe to ship to the browser.
 *
 * Next.js inlines `NEXT_PUBLIC_*` at build time by matching the literal text
 * `process.env.NEXT_PUBLIC_FOO`, so each one must be referenced explicitly
 * below. Destructuring `process.env` or indexing it dynamically produces
 * `undefined` in the client bundle — that failure is silent, which is why this
 * file parses eagerly and throws instead.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL." }),
  /**
   * The anon key is public by design: it identifies the project and carries the
   * `anon` role, and every table it can reach is gated by RLS. It is not a
   * secret, and treating it as one leads people to hide it while leaving RLS
   * off — which is the actual vulnerability.
   */
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY looks truncated."),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
});

const parsed = publicEnvSchema.safeParse(
  withoutBlanks({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  }),
);

if (!parsed.success) {
  throw new Error(
    `Invalid public environment variables:\n${z.prettifyError(parsed.error)}\n\nCopy .env.example to .env.local and fill it in.`,
  );
}

export const publicEnv = parsed.data;
