import { describe, expect, it } from "vitest";

import { isProtectedPath, routes, safeRedirectPath } from "@/lib/routes";

/**
 * `isProtectedPath` is the input to `middleware.ts`, so a hole here is an
 * authorization hole, not a cosmetic bug. The prefix cases below are the ones a
 * naive `startsWith` gets wrong in opposite directions: `/dashboardsomething`
 * must NOT match (it is a different, unguarded route), while `/dashboard/resumes`
 * must match (a child of a guarded area).
 */
describe("isProtectedPath", () => {
  it("guards each protected root exactly", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/builder")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
  });

  it("guards nested paths under a protected root", () => {
    expect(isProtectedPath("/dashboard/resumes")).toBe(true);
    expect(isProtectedPath("/builder/abc-123")).toBe(true);
    expect(isProtectedPath("/settings/account")).toBe(true);
  });

  it("does not guard a route that merely shares a prefix", () => {
    expect(isProtectedPath("/dashboards")).toBe(false);
    expect(isProtectedPath("/builder-guide")).toBe(false);
    expect(isProtectedPath("/settings-faq")).toBe(false);
  });

  it("leaves public routes open", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath(routes.login)).toBe(false);
    expect(isProtectedPath(routes.signup)).toBe(false);
    expect(isProtectedPath("/r/some-share-slug")).toBe(false);
    expect(isProtectedPath("/print/token")).toBe(false);
  });
});

/**
 * This is the open-redirect guard. Every case below is a real payload someone
 * would put in a phishing link, so a regression here is exploitable rather than
 * cosmetic.
 */
describe("safeRedirectPath", () => {
  it("keeps a same-origin path, with query and hash", () => {
    expect(safeRedirectPath("/dashboard/resumes")).toBe("/dashboard/resumes");
    expect(safeRedirectPath("/dashboard?tab=drafts")).toBe("/dashboard?tab=drafts");
    expect(safeRedirectPath("/settings#ai")).toBe("/settings#ai");
  });

  it("rejects absolute URLs", () => {
    expect(safeRedirectPath("https://evil.example/login")).toBe(routes.dashboard);
    expect(safeRedirectPath("http://evil.example")).toBe(routes.dashboard);
    expect(safeRedirectPath("javascript:alert(1)")).toBe(routes.dashboard);
    expect(safeRedirectPath("data:text/html,<script>")).toBe(routes.dashboard);
  });

  it("rejects paths that only look relative", () => {
    // Protocol-relative, and the two spellings the URL parser folds into it.
    expect(safeRedirectPath("//evil.example")).toBe(routes.dashboard);
    expect(safeRedirectPath("/\\evil.example")).toBe(routes.dashboard);
    expect(safeRedirectPath("/\\/evil.example")).toBe(routes.dashboard);
  });

  it("rejects auth screens, which would bounce straight back out", () => {
    expect(safeRedirectPath(routes.login)).toBe(routes.dashboard);
    expect(safeRedirectPath(routes.signup)).toBe(routes.dashboard);
    expect(safeRedirectPath(routes.resetPassword)).toBe(routes.dashboard);
    expect(safeRedirectPath(routes.authCallback)).toBe(routes.dashboard);
  });

  it("falls back on absent or empty input", () => {
    expect(safeRedirectPath(null)).toBe(routes.dashboard);
    expect(safeRedirectPath(undefined)).toBe(routes.dashboard);
    expect(safeRedirectPath("")).toBe(routes.dashboard);
  });

  it("honours an explicit fallback", () => {
    expect(safeRedirectPath("https://evil.example", routes.home)).toBe(routes.home);
  });
});

describe("route builders", () => {
  it("builds resume-scoped paths", () => {
    expect(routes.builder("abc")).toBe("/builder/abc");
    expect(routes.share("my-cv")).toBe("/r/my-cv");
    expect(routes.print("t0ken")).toBe("/print/t0ken");
  });

  it("keeps the builder path inside the guarded prefix", () => {
    // If `builder()` ever moved out from under `/builder`, middleware would stop
    // covering it silently. This ties the two together.
    expect(isProtectedPath(routes.builder("abc"))).toBe(true);
  });
});
