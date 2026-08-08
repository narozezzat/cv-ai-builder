import { unstable_rethrow } from "next/navigation";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

/**
 * The contract between a Server Action and the form that called it.
 *
 * Lives in the form layer rather than in a feature because every feature that
 * submits a form needs it, and a per-feature copy is three copies of the same
 * `setError` plumbing that then drift apart. Type-only imports from
 * `react-hook-form` keep this file free of runtime dependencies, so a
 * `"use server"` module can import `actionError` without pulling React Hook Form
 * into anything.
 *
 * Actions report failure by returning; success is either a redirect (auth, where
 * the session changed and only a fresh server render sees the new cookie) or an
 * `ok` result (settings, where the page stays put and a toast is the feedback).
 */

export type ActionFailure = {
  ok?: false;
  /** Form-level message. Rendered by `<FormError />`. */
  error: string;
  /** Keyed by form field name; merged into React Hook Form's error state. */
  fieldErrors?: Record<string, string>;
};

export type ActionSuccess = {
  ok: true;
  /** Optional confirmation for the caller to toast. */
  message?: string;
};

export type ActionResult = ActionFailure | ActionSuccess;

export function actionError(error: string, fieldErrors?: Record<string, string>): ActionFailure {
  return fieldErrors ? { error, fieldErrors } : { error };
}

export function actionSuccess(message?: string): ActionSuccess {
  return message ? { ok: true, message } : { ok: true };
}

export function isActionFailure(result: ActionResult | void): result is ActionFailure {
  return Boolean(result) && result?.ok !== true;
}

/**
 * Shown when the action never produced a result at all — a dropped connection, a
 * deploy mid-submit, a browser offline. Distinct from anything the action itself
 * reports, because the request may well have succeeded server-side.
 *
 * It is *not* shown for a redirect. `redirect()` interrupts a Server Action by
 * throwing, and that rejection reaches the caller here too, so a blanket `catch`
 * reports every successful redirecting submit as a failure. Where the redirect
 * lands on a different route the replaced page hides it; where it lands on the
 * same route — `/forgot-password?sent=1`, `/verify-email?sent=1` — the form stays
 * mounted and the user sees this message directly beside the success banner.
 * `unstable_rethrow` in `runAction` is the guard, and the test beside this file
 * pins it.
 *
 * Deliberately not imported from the auth feature's error mapper: that module
 * pulls in `@supabase/supabase-js`, and this string is consumed by client
 * components.
 */
const TRANSPORT_ERROR = "Something went wrong. Try again in a moment.";

/** Merges a failed action's messages into the form's error state. */
export function applyActionResult<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
  result: ActionFailure,
): void {
  form.setError("root", { message: result.error });

  for (const [name, message] of Object.entries(result.fieldErrors ?? {})) {
    form.setError(name as Path<TFieldValues>, { message }, { shouldFocus: true });
  }
}

/**
 * Runs a Server Action from a submit handler and routes its outcome into the form.
 *
 * The returned promise is what React Hook Form awaits, so `isSubmitting` — and
 * every `<SubmitButton>` reading it — stays true for exactly as long as the action
 * is in flight. For an action that redirects, `isSubmitting` never goes back to
 * false, which is correct: the button should stay busy through the navigation
 * rather than flicker back to idle on a page that is being replaced.
 *
 * `onSuccess` fires only for an explicit `{ ok: true }`. A redirecting action
 * never resolves at all — it rejects with the router's `NEXT_REDIRECT` signal,
 * which the `catch` below hands straight back to the framework.
 */
export async function runAction<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
  action: () => Promise<ActionResult | void>,
  onSuccess?: (result: ActionSuccess) => void,
): Promise<void> {
  form.clearErrors("root");

  try {
    const result = await action();

    if (isActionFailure(result)) {
      applyActionResult(form, result);
      return;
    }

    if (result?.ok) {
      onSuccess?.(result);
    }
  } catch (error) {
    // A redirecting action rejects rather than resolves, so this `catch` sees the
    // framework's own control-flow signal on the *success* path. Rethrowing it
    // first is what keeps a successful submit from being reported as a failure —
    // see the note on `TRANSPORT_ERROR`.
    unstable_rethrow(error);

    form.setError("root", { message: TRANSPORT_ERROR });
  }
}
