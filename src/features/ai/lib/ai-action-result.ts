/**
 * What every AI action returns.
 *
 * `ActionResult` from the form layer is deliberately not reused here. It models a
 * form submission — one message, optional field errors — and an AI call has three
 * things a form does not: a payload, a post-charge credit balance, and a machine
 * code the UI branches on. "Out of credits" needs an upgrade link, "rate limited"
 * needs a wait, "provider unavailable" needs a retry button; collapsed into one
 * string they all become the same toast.
 *
 * Nothing in this file imports a value from `services/ai`. `AiErrorCode` arrives as
 * a type, which TypeScript erases, so a client component can import these shapes
 * without dragging a `server-only` module into the browser bundle.
 */

import type { AiErrorCode } from "@/services/ai";

export type AiActionSuccess<TData> = {
  ok: true;
  data: TData;
  /** Balance after the charge, so the credits meter updates without a refetch. */
  creditsRemaining: number;
};

export type AiActionFailure = {
  ok: false;
  code: AiErrorCode;
  /** Safe to render: the fixed copy from `AI_ERROR_MESSAGES`, never a provider's. */
  error: string;
  /** Whether retrying the identical request is worth offering. */
  retryable: boolean;
};

export type AiActionResult<TData> = AiActionSuccess<TData> | AiActionFailure;

/**
 * Attribution and cancellation, kept out of the capability inputs.
 *
 * Separate from the task input because it is not the model's business: `resumeId`
 * exists so per-document AI spend is answerable in the ledger, and widening a
 * capability's own schema to carry it would put it in the prompt.
 */
export type AiActionOptions = {
  resumeId?: string | null;
};

export function isAiActionFailure<TData>(result: AiActionResult<TData>): result is AiActionFailure {
  return !result.ok;
}
