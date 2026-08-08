import { describe, expect, it } from "vitest";

import { routes } from "@/lib/routes";

import {
  callbackTargets,
  emailRedirectTo,
  RECOVERY_FLOW,
  RECOVERY_FLOW_PARAM,
} from "./recovery-flow";

const query = (search: string) => new URLSearchParams(search);

/**
 * The other end of `callbackTargets`: what a mail link carries back. Asserted as a
 * round trip, because the two agreeing is the only property that matters — a link
 * that omits `next` produces no error, only a user who finishes somewhere else.
 */
describe("emailRedirectTo", () => {
  const search = (url: string) => new URL(url).searchParams;

  it("points at our own callback with next attached", () => {
    const url = new URL(emailRedirectTo(routes.settingsAccount));

    expect(url.pathname).toBe(routes.authCallback);
    expect(url.searchParams.get("next")).toBe(routes.settingsAccount);
    expect(callbackTargets(url.searchParams).destination).toBe(routes.settingsAccount);
  });

  it("marks a recovery link so the callback can recognise the return", () => {
    const params = search(emailRedirectTo(routes.resetPassword, RECOVERY_FLOW));

    expect(params.get(RECOVERY_FLOW_PARAM)).toBe(RECOVERY_FLOW);
    expect(callbackTargets(params).destination).toBe(routes.resetPassword);
  });

  it("omits the marker for every other flow", () => {
    expect(search(emailRedirectTo(routes.dashboard)).has(RECOVERY_FLOW_PARAM)).toBe(false);
  });
});

/**
 * These cases are transcriptions of what GoTrue actually sends, measured against a
 * local Supabase: a recovery mail links to
 * `/auth/v1/verify?token=pkce_…&type=recovery&redirect_to=<callback>`, and GoTrue
 * then redirects to the callback with `code` and `next` only. `type` does not
 * survive that hop, which is why the callback cannot route on it.
 */
describe("callbackTargets", () => {
  it("sends a PKCE recovery return to the reset form, not the dashboard", () => {
    const targets = callbackTargets(
      query(`code=abc123&next=%2Freset-password&${RECOVERY_FLOW_PARAM}=${RECOVERY_FLOW}`),
    );

    expect(targets.destination).toBe(routes.resetPassword);
    expect(targets.errorPath).toBe(routes.forgotPassword);
  });

  it("still honours GoTrue's own type when it is present", () => {
    const targets = callbackTargets(query("token_hash=xyz&type=recovery"));

    expect(targets.destination).toBe(routes.resetPassword);
    expect(targets.errorPath).toBe(routes.forgotPassword);
  });

  it("sends an ordinary confirmation to its next path", () => {
    const targets = callbackTargets(query("code=abc123&next=%2Fdashboard%2Fresumes"));

    expect(targets.destination).toBe("/dashboard/resumes");
    expect(targets.errorPath).toBe(routes.login);
  });

  it("falls back to the dashboard when next is absent", () => {
    expect(callbackTargets(query("code=abc123")).destination).toBe(routes.dashboard);
  });

  /**
   * SECURITY: the marker only names the flow. It must not become a second way to
   * pick a destination, and `next` must stay same-origin regardless of it.
   */
  it("does not let the marker widen where a non-recovery return can land", () => {
    const targets = callbackTargets(query("code=abc123&next=https%3A%2F%2Fevil.example"));

    expect(targets.destination).toBe(routes.dashboard);
  });

  it("ignores an unrecognised marker value", () => {
    const targets = callbackTargets(
      query(`code=abc123&next=%2Freset-password&${RECOVERY_FLOW_PARAM}=whatever`),
    );

    expect(targets.destination).toBe(routes.dashboard);
    expect(targets.errorPath).toBe(routes.login);
  });
});
