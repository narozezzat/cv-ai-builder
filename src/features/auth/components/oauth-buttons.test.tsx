/**
 * `OAuthButtons` catches around its own action call instead of going through
 * `runAction`, so it needs its own proof that the catch tells a redirect apart from
 * a failure. This is the bug `runAction` shipped once: a `catch` that treats every
 * rejection as an error turns Next's success signal — a rejected action promise
 * carrying `NEXT_REDIRECT` — into "sign-in failed" on screen, while the navigation
 * it was announcing still happens underneath.
 *
 * The action redirects cross-origin today (to the provider's consent screen), which
 * resolves rather than rejects, so nothing about the current happy path exercises
 * the guard. That is precisely why it is asserted here: the day this action
 * redirects anywhere app-relative, the guard is the only thing standing between
 * that change and a false error message.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const signInWithOAuthAction = vi.fn();

vi.mock("../actions/auth-actions", () => ({
  signInWithOAuthAction: (...args: unknown[]) => signInWithOAuthAction(...args),
}));

const { OAuthButtons } = await import("./oauth-buttons");

const TRANSPORT_ERROR = "Could not reach the sign-in service. Check your connection.";

/**
 * What Next rejects an action promise with when the action redirected somewhere
 * app-relative — built by hand rather than by calling `redirect()`, which needs a
 * request scope this component test does not have.
 */
function redirectError(): Error {
  return Object.assign(new Error("NEXT_REDIRECT"), {
    digest: "NEXT_REDIRECT;replace;/dashboard;307;",
  });
}

/**
 * `start` is fired as `void start(provider)`, so a rethrown framework signal leaves
 * the component as an unhandled rejection — correct behaviour, and the router is
 * what handles it in a real app. Collecting them here keeps that from being read as
 * a test failure, and lets the assertions confirm the signal really did escape
 * rather than being swallowed into state.
 */
const escaped: unknown[] = [];
const collect = (reason: unknown) => escaped.push(reason);

beforeAll(() => {
  process.on("unhandledRejection", collect);
});

afterAll(() => {
  process.off("unhandledRejection", collect);
});

afterEach(() => {
  escaped.length = 0;
  vi.clearAllMocks();
});

describe("OAuthButtons", () => {
  it("hands a redirect signal back to the router instead of reporting it", async () => {
    signInWithOAuthAction.mockRejectedValue(redirectError());

    render(<OAuthButtons providers={["google"]} />);
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() => expect(escaped).toHaveLength(1));

    expect((escaped[0] as Error).message).toBe("NEXT_REDIRECT");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports a real transport failure", async () => {
    signInWithOAuthAction.mockRejectedValue(new TypeError("Failed to fetch"));

    render(<OAuthButtons providers={["google"]} />);
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(TRANSPORT_ERROR);
    expect(escaped).toHaveLength(0);
    // Cleared, so the user can try again — a spinner stuck on a button that will
    // never navigate is a dead end.
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeEnabled();
  });

  it("shows the error the action returned, without touching the catch", async () => {
    signInWithOAuthAction.mockResolvedValue({ error: "Google sign-in is unavailable." });

    render(<OAuthButtons providers={["google"]} />);
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Google sign-in is unavailable.");
  });

  it("renders nothing at all when no provider is configured", () => {
    // Including the divider: an "or" with nothing above it reads as a missing button.
    const { container } = render(<OAuthButtons providers={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
