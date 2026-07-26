/**
 * Every internal path in one place.
 *
 * Two reasons this is not a scattering of string literals: renaming a route
 * becomes a single edit that the type checker propagates, and `middleware.ts`
 * needs the auth/app split as data so it can decide what to guard without
 * duplicating a second list that silently drifts.
 */

export const routes = {
  home: "/",
  pricing: "/#pricing",
  templates: "/#templates",
  faq: "/#faq",
  terms: "/terms",
  privacy: "/privacy",

  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
  authCallback: "/auth/callback",

  dashboard: "/dashboard",
  resumes: "/dashboard/resumes",
  trash: "/dashboard/trash",
  templateGallery: "/dashboard/templates",
  settings: "/settings",
  settingsAccount: "/settings/account",
  settingsAppearance: "/settings/appearance",
  settingsAi: "/settings/ai",

  /** Builder for a specific resume. */
  builder: (resumeId: string) => `/builder/${resumeId}`,
  /** Public share page. Rendered under the public-read RLS policy. */
  share: (slug: string) => `/r/${slug}`,
  /** Signed, short-lived render target used only by the PDF pipeline. */
  print: (token: string) => `/print/${token}`,
} as const;

/**
 * Prefixes that require a session. `middleware.ts` matches against these, so a
 * new protected area is one entry here rather than a new redirect branch.
 */
export const PROTECTED_PREFIXES = ["/dashboard", "/builder", "/settings"] as const;

/** Auth screens a signed-in user should be bounced away from. */
export const AUTH_ROUTES = [routes.login, routes.signup, routes.forgotPassword] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Query parameter carrying the post-login destination. */
export const NEXT_PARAM = "next";

/**
 * Only used to give the URL parser an origin to resolve against. Any value works
 * as long as the comparison below uses the same one.
 */
const RESOLUTION_ORIGIN = "http://redirect.invalid";

/**
 * Screens that must never be a post-auth destination, because landing on one
 * with a fresh session either bounces straight back out (middleware sends
 * signed-in users away from `/login`) or strands the user on a page whose entire
 * purpose is already served.
 */
const NON_DESTINATIONS: readonly string[] = [
  ...AUTH_ROUTES,
  routes.resetPassword,
  routes.verifyEmail,
  routes.authCallback,
];

/**
 * Narrows an attacker-controlled `next` value to a same-origin path.
 *
 * SECURITY: every caller of this function receives its input from a query
 * string — `middleware.ts` writes one, but an attacker can hand a victim a link
 * carrying any value at all. Reflecting that into a redirect without checking is
 * an open redirect: `/login?next=https://evil.example` produces a phishing page
 * that arrives on our own domain, past the user's one reliable trust signal, and
 * for OAuth it can bounce a freshly-minted session off-site.
 *
 * Parsing rather than pattern-matching, because the interesting inputs are the
 * ones that only look relative. `//evil.example` is protocol-relative and
 * `/\evil.example` is normalized to the same thing by the WHATWG URL parser, so
 * both resolve to a foreign origin and are rejected here — a naive
 * `startsWith("/")` accepts both.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback: string = routes.dashboard,
): string {
  if (!value || !value.startsWith("/")) {
    return fallback;
  }

  let url: URL;

  try {
    url = new URL(value, RESOLUTION_ORIGIN);
  } catch {
    return fallback;
  }

  if (url.origin !== RESOLUTION_ORIGIN || NON_DESTINATIONS.includes(url.pathname)) {
    return fallback;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
