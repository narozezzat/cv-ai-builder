// @vitest-environment node

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { PRINT_TOKEN_TTL_SECONDS, parsePrintToken, signPrintToken } from "./print-token";

/**
 * These are security tests, not round-trip tests.
 *
 * `/print/[token]` has no session to check — the token is the only thing standing between
 * headless Chromium and any resume in the database. So every case below is a way an
 * attacker gets to influence the input: a payload edited in place, a signature borrowed
 * from another token, a token signed with a secret from a different deploy, and a token
 * that was genuine an hour ago.
 *
 * A fixed secret, and `now` passed in: the pure pair takes both explicitly so this file
 * needs no environment and no waiting.
 */

const SECRET = "0".repeat(32) + "1".repeat(32);
const OTHER_SECRET = "2".repeat(64);
const NOW = 1_800_000_000;

const PAYLOAD = {
  resumeId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  expiresAt: NOW + PRINT_TOKEN_TTL_SECONDS,
};

function tamperPayload(token: string, mutate: (wire: Record<string, unknown>) => void): string {
  const [version, payload, sig] = token.split(".") as [string, string, string];
  const wire = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;

  mutate(wire);

  return [version, Buffer.from(JSON.stringify(wire)).toString("base64url"), sig].join(".");
}

describe("print token", () => {
  it("round-trips a payload", () => {
    const result = parsePrintToken(SECRET, signPrintToken(SECRET, PAYLOAD), NOW);

    expect(result).toEqual({ ok: true, payload: PAYLOAD });
  });

  it("produces a URL-safe token", () => {
    // The token is a path segment. Base64 with `+`, `/`, or `=` in it would either need
    // escaping at every call site or silently truncate at the first `/`.
    expect(signPrintToken(SECRET, PAYLOAD)).toMatch(/^v1\.[\w-]+\.[\w-]+$/);
  });

  it("rejects a swapped resume id", () => {
    // The attack this exists for: take your own valid token, point it at someone else's
    // resume. The signature covers the payload, so editing it invalidates the token.
    const token = tamperPayload(signPrintToken(SECRET, PAYLOAD), (wire) => {
      wire.r = "33333333-3333-4333-8333-333333333333";
    });

    expect(parsePrintToken(SECRET, token, NOW)).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects a swapped user id", () => {
    // The route reads as whoever `u` names, so this field is the one that must not be
    // editable — a forged `u` would make the service-role read run as another account.
    const token = tamperPayload(signPrintToken(SECRET, PAYLOAD), (wire) => {
      wire.u = "44444444-4444-4444-8444-444444444444";
    });

    expect(parsePrintToken(SECRET, token, NOW)).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects an extended expiry", () => {
    const token = tamperPayload(signPrintToken(SECRET, PAYLOAD), (wire) => {
      wire.e = NOW + 86_400;
    });

    expect(parsePrintToken(SECRET, token, NOW)).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects a token signed with another secret", () => {
    const token = signPrintToken(OTHER_SECRET, PAYLOAD);

    expect(parsePrintToken(SECRET, token, NOW)).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects an expired token", () => {
    const token = signPrintToken(SECRET, PAYLOAD);

    expect(parsePrintToken(SECRET, token, PAYLOAD.expiresAt + 1)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("treats the expiry second itself as expired", () => {
    const token = signPrintToken(SECRET, PAYLOAD);

    expect(parsePrintToken(SECRET, token, PAYLOAD.expiresAt)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("rejects a token whose signature came from a different payload", () => {
    const mine = signPrintToken(SECRET, PAYLOAD);
    const theirs = signPrintToken(SECRET, { ...PAYLOAD, resumeId: "cross-signed" });
    const [version, payload] = mine.split(".") as [string, string];
    const stolenSignature = theirs.split(".")[2] as string;

    expect(parsePrintToken(SECRET, `${version}.${payload}.${stolenSignature}`, NOW)).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it.each([
    ["empty", ""],
    ["one segment", "garbage"],
    ["two segments", "v1.abc"],
    ["four segments", "v1.abc.def.ghi"],
    ["unknown version", "v2.abc.def"],
  ])("rejects a %s token as malformed", (_label, token) => {
    expect(parsePrintToken(SECRET, token, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects a signed payload missing its fields", () => {
    // A token from an older deploy is authentic, so the signature check passes and the
    // shape check is the only thing that stops `undefined` reaching a query filter.
    const body = `v1.${Buffer.from(JSON.stringify({ r: "only-a-resume" })).toString("base64url")}`;
    const sig = createHmac("sha256", SECRET).update(body).digest("base64url");

    expect(parsePrintToken(SECRET, `${body}.${sig}`, NOW)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});
