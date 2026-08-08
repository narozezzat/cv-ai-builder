/**
 * Facts about the current request, read from headers rather than from input.
 *
 * SECURITY: the reason this module exists is that rate limiting and audit
 * logging must not be steerable by the caller. A client that gets to name its
 * own rate-limit subject can burn someone else's allowance or dodge its own
 * limit by sending a fresh identifier every attempt, so the subject is derived
 * here — from the connection's forwarded IP and from values already validated
 * server-side — and never accepted as a parameter.
 */

import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

export type RequestContext = {
  /** Client IP as reported by the proxy, or null when it cannot be determined. */
  ip: string | null;
  userAgent: string | null;
};

/**
 * The forwarded client IP.
 *
 * `x-forwarded-for` is a comma-separated chain and only the first entry is the
 * original client; the rest are proxies. It is spoofable in general — anyone can
 * send the header — but Vercel overwrites it at the edge, so on the deployment
 * target it is trustworthy. `next start` populates it too, so a local run does get
 * a value; what has no value is a request that arrives without the header at all,
 * which is why every consumer handles null rather than assuming one.
 */
export async function getRequestContext(): Promise<RequestContext> {
  const headerList = await headers();

  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || headerList.get("x-real-ip") || null;

  return { ip: ip || null, userAgent: headerList.get("user-agent") };
}

/**
 * Stable, non-reversible identifier for a rate-limit subject.
 *
 * Hashed rather than stored raw because the rate-limit table would otherwise
 * accumulate a log of which email addresses tried to sign in from which IP —
 * personal data with no operational value, since the limiter only ever compares
 * for equality. Truncated to 32 hex characters: 128 bits of a SHA-256 is far
 * past any collision that matters for counting attempts.
 */
export function rateLimitSubject(kind: string, value: string): string {
  const digest = createHash("sha256").update(`${kind}:${value.toLowerCase()}`).digest("hex");

  return `${kind}:${digest.slice(0, 32)}`;
}
