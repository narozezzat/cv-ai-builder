import "server-only";

/**
 * The capability that lets headless Chromium read one resume, once, for a minute.
 *
 * SECURITY — this module is the whole authorization story for `/print/[token]`, so it
 * is worth stating why the route cannot be protected the ordinary way.
 *
 * The renderer navigates to our own app with no cookies: it is a fresh browser process
 * with an empty profile, and there is no session for it to carry. So the cookie-bound
 * Supabase client — and with it RLS, and with it `isProtectedPath` — cannot scope that
 * request to a user. The route therefore takes its authority from the URL itself, and
 * the token is what makes that safe:
 *
 * - It is signed with `EXPORT_TOKEN_SECRET` (HMAC-SHA256). Nothing in the payload is
 *   trusted until the signature verifies, which is what stops `?r=<someone-else's-id>`
 *   from being a resume-disclosure endpoint.
 * - It carries the owner's id, put there from a verified session by the export action.
 *   The route reads the resume with the service-role client scoped to *that* id, so a
 *   valid token for resume A can never return resume B.
 * - It expires in `PRINT_TOKEN_TTL_SECONDS`. A URL that leaks into a log, a proxy, or a
 *   screenshot is a live capability until it does.
 *
 * The pure `signPrintToken`/`parsePrintToken` pair takes the secret explicitly so the
 * test suite can drive both sides without an environment; `mintPrintToken`/
 * `verifyPrintToken` are the thin env-reading wrappers everything else calls.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { requireServerEnv } from "@/lib/env/server";

/**
 * How long a print URL stays live.
 *
 * Long enough for a cold Chromium start plus a slow render, short enough that a leaked
 * URL is worthless by the time anyone reads it. The renderer navigates within
 * milliseconds of minting, so this is almost entirely slack.
 */
export const PRINT_TOKEN_TTL_SECONDS = 120;

/** Prefix and version marker. Bumping it invalidates every token in flight. */
const TOKEN_VERSION = "v1";

export type PrintTokenPayload = {
  /** Resume id to render. */
  resumeId: string;
  /** Owner, taken from the session at mint time. The only id the route will read as. */
  userId: string;
  /** Expiry, epoch seconds. */
  expiresAt: number;
};

export type PrintTokenResult =
  { ok: true; payload: PrintTokenPayload } | { ok: false; reason: PrintTokenFailure };

/**
 * Why a token was rejected. Never surfaced to a caller — `/print` answers every failure
 * with the same 404, because distinguishing "expired" from "forged" tells an attacker
 * which half of the token to keep working on.
 */
export type PrintTokenFailure = "malformed" | "bad-signature" | "expired";

/** Wire form of the payload. Single letters: the token ends up in a URL. */
type WirePayload = {
  r: string;
  u: string;
  e: number;
};

function signature(secret: string, body: string): Buffer {
  return createHmac("sha256", secret).update(body).digest();
}

/**
 * `<version>.<base64url payload>.<base64url hmac>`.
 *
 * The signature covers `"<version>.<payload>"` and not the payload alone, so a token
 * cannot be replayed against a future format that reads the same bytes differently.
 */
export function signPrintToken(secret: string, payload: PrintTokenPayload): string {
  const wire: WirePayload = {
    r: payload.resumeId,
    u: payload.userId,
    e: payload.expiresAt,
  };

  const body = `${TOKEN_VERSION}.${Buffer.from(JSON.stringify(wire)).toString("base64url")}`;

  return `${body}.${signature(secret, body).toString("base64url")}`;
}

/**
 * Verifies and decodes a token.
 *
 * Order matters: the signature is checked before the payload is believed, and expiry is
 * checked after — an expired token is still a genuine one, and treating it as forged
 * would hide clock skew behind a security error.
 *
 * `nowSeconds` is a parameter rather than a `Date.now()` call so the expiry branch is
 * testable without waiting two minutes.
 */
export function parsePrintToken(
  secret: string,
  token: string,
  nowSeconds: number,
): PrintTokenResult {
  const parts = token.split(".");

  if (parts.length !== 3) {
    return { ok: false, reason: "malformed" };
  }

  const [version, encodedPayload, encodedSignature] = parts as [string, string, string];

  if (version !== TOKEN_VERSION) {
    return { ok: false, reason: "malformed" };
  }

  const expected = signature(secret, `${version}.${encodedPayload}`);
  const provided = Buffer.from(encodedSignature, "base64url");

  // Length check first: `timingSafeEqual` throws on a length mismatch rather than
  // returning false, and the length is not a secret.
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: "bad-signature" };
  }

  let wire: unknown;

  try {
    wire = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (!isWirePayload(wire)) {
    return { ok: false, reason: "malformed" };
  }

  if (wire.e <= nowSeconds) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, payload: { resumeId: wire.r, userId: wire.u, expiresAt: wire.e } };
}

/**
 * Shape check on a signed payload.
 *
 * Still validated even though the signature already proved we wrote it: a token minted
 * by an older deploy is authentic and may not match today's fields, and reading
 * `wire.u` as a `string` when it is `undefined` would put `undefined` into a query
 * filter — which is not a syntax error, it is a missing predicate.
 */
function isWirePayload(value: unknown): value is WirePayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.r === "string" &&
    candidate.r.length > 0 &&
    typeof candidate.u === "string" &&
    candidate.u.length > 0 &&
    typeof candidate.e === "number" &&
    Number.isFinite(candidate.e)
  );
}

/** Mints a token for a resume the caller has already been proven to own. */
export function mintPrintToken(input: { resumeId: string; userId: string }): string {
  const secret = requireServerEnv("EXPORT_TOKEN_SECRET");
  const expiresAt = Math.floor(Date.now() / 1000) + PRINT_TOKEN_TTL_SECONDS;

  return signPrintToken(secret, { ...input, expiresAt });
}

/** Verifies a token from the URL. Returns the payload only if it is currently valid. */
export function verifyPrintToken(token: string): PrintTokenResult {
  const secret = requireServerEnv("EXPORT_TOKEN_SECRET");

  return parsePrintToken(secret, token, Math.floor(Date.now() / 1000));
}
