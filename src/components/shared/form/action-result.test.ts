/**
 * `runAction` is the only place in the app that wraps a Server Action call in a
 * `try`, which makes it the only place that can mistake the framework's own
 * control-flow signals for failures.
 *
 * That is not a hypothetical: `redirect()` interrupts an action by throwing, and
 * the rejection reaches the caller, so before `unstable_rethrow` was added every
 * successful redirecting submit painted "Something went wrong." Where the redirect
 * changed route the replaced page hid it; on `/forgot-password?sent=1` — a redirect
 * to the route the form is already on — the form stayed mounted and the error
 * rendered beside the "Check your inbox" banner.
 *
 * The digests below are built the way Next builds them rather than by calling
 * `redirect()`, because `redirect()` from a test would need a request scope. They
 * have to satisfy `isRedirectError` / `isHTTPAccessFallbackError` exactly, which is
 * the point: if a Next upgrade changes the digest format, these fail here instead
 * of in a user's browser.
 */

import type { FieldValues, UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { actionError, actionSuccess, isActionFailure, runAction } from "./action-result";

const TRANSPORT_ERROR = "Something went wrong. Try again in a moment.";

interface FormSpy {
  form: UseFormReturn<FieldValues>;
  setError: ReturnType<typeof vi.fn>;
  clearErrors: ReturnType<typeof vi.fn>;
}

/**
 * `runAction` touches two methods and nothing else, so a spy is a truer unit than
 * a rendered `useForm` — it fails on the behaviour under test rather than on
 * anything React Hook Form changes around it.
 */
function formSpy(): FormSpy {
  const setError = vi.fn();
  const clearErrors = vi.fn();

  return {
    setError,
    clearErrors,
    form: { setError, clearErrors } as unknown as UseFormReturn<FieldValues>,
  };
}

/** Shaped like the error `redirect(path)` throws, digest and all. */
function redirectError(path: string, type: "push" | "replace" = "push"): Error {
  const error = new Error("NEXT_REDIRECT");

  return Object.assign(error, { digest: `NEXT_REDIRECT;${type};${path};307;` });
}

/** Shaped like the error `notFound()` throws. */
function notFoundError(): Error {
  return Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK"), {
    digest: "NEXT_HTTP_ERROR_FALLBACK;404",
  });
}

describe("isActionFailure", () => {
  it("treats a returned error as a failure", () => {
    expect(isActionFailure(actionError("nope"))).toBe(true);
  });

  it("does not treat an ok result as a failure", () => {
    expect(isActionFailure(actionSuccess("saved"))).toBe(false);
  });

  it("does not treat a redirecting action's empty return as a failure", () => {
    expect(isActionFailure(undefined)).toBe(false);
  });
});

describe("runAction", () => {
  it("rethrows a redirect instead of reporting it as a failure", async () => {
    const { form, setError } = formSpy();
    const signal = redirectError("/forgot-password?sent=1");

    // The rejection has to escape `runAction` untouched: it is how the router
    // learns to navigate. Swallowing it strands the user on the current page.
    await expect(runAction(form, () => Promise.reject(signal))).rejects.toBe(signal);

    expect(setError).not.toHaveBeenCalled();
  });

  it("rethrows a redirect to the route the form is already on", async () => {
    // The regression that shipped. A same-route redirect leaves the form mounted,
    // so a swallowed signal is visible to the user rather than hidden by a
    // replaced page.
    const { form, setError } = formSpy();

    await expect(
      runAction(form, () => Promise.reject(redirectError("/verify-email?sent=1", "replace"))),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(setError).not.toHaveBeenCalled();
  });

  it("rethrows a not-found signal", async () => {
    const { form, setError } = formSpy();

    await expect(runAction(form, () => Promise.reject(notFoundError()))).rejects.toThrow();

    expect(setError).not.toHaveBeenCalled();
  });

  it("reports a genuine transport failure on the form", async () => {
    const { form, setError } = formSpy();

    await expect(
      runAction(form, () => Promise.reject(new TypeError("Failed to fetch"))),
    ).resolves.toBeUndefined();

    expect(setError).toHaveBeenCalledWith("root", { message: TRANSPORT_ERROR });
  });

  it("does not mistake a thrown non-Error for a redirect", async () => {
    const { form, setError } = formSpy();

    await expect(runAction(form, () => Promise.reject("boom"))).resolves.toBeUndefined();

    expect(setError).toHaveBeenCalledWith("root", { message: TRANSPORT_ERROR });
  });

  it("clears a stale root error before running", async () => {
    const { form, clearErrors } = formSpy();

    await runAction(form, async () => actionSuccess());

    expect(clearErrors).toHaveBeenCalledWith("root");
  });

  it("applies a returned failure to the root and its fields", async () => {
    const { form, setError } = formSpy();

    await runAction(form, async () =>
      actionError("Check the form.", { email: "Enter a valid email address." }),
    );

    expect(setError).toHaveBeenCalledWith("root", { message: "Check the form." });
    expect(setError).toHaveBeenCalledWith(
      "email",
      { message: "Enter a valid email address." },
      { shouldFocus: true },
    );
  });

  it("calls onSuccess only for an explicit ok result", async () => {
    const onSuccess = vi.fn();

    await runAction(formSpy().form, async () => actionSuccess("Saved."), onSuccess);
    expect(onSuccess).toHaveBeenCalledWith({ ok: true, message: "Saved." });

    onSuccess.mockClear();

    await runAction(formSpy().form, async () => actionError("nope"), onSuccess);
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
