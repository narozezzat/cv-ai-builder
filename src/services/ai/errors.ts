/**
 * One error type for the whole AI surface.
 *
 * Every failure a caller can meaningfully act on gets a code, because the UI has
 * genuinely different responses: "out of credits" needs an upgrade link, "rate
 * limited" needs a wait, "provider unavailable" needs a retry button, and
 * "invalid output" needs a regenerate. Handing actions a bare `Error` would
 * collapse all four into one toast.
 *
 * SECURITY: `message` here is safe to render. Provider errors can carry request
 * bodies, URLs, and API-key fragments in their own messages, so `toAiError` maps
 * them to a fixed sentence and keeps the original only as `cause` — which stays
 * server-side, in the log.
 */

import "server-only";

import { APICallError, NoObjectGeneratedError, NoOutputGeneratedError, RetryError } from "ai";

export const AI_ERROR_CODES = [
  "unauthenticated",
  "not_configured",
  "rate_limited",
  "insufficient_credits",
  "provider_unavailable",
  "invalid_output",
  "invalid_input",
  "timeout",
  "aborted",
  "unknown",
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

/** User-facing copy. Deliberately free of provider names and model ids. */
export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  unauthenticated: "Sign in to use AI features.",
  not_configured: "AI features are not available right now.",
  rate_limited: "Too many AI requests. Wait a moment and try again.",
  insufficient_credits: "You're out of AI credits. They reset monthly, or upgrade for more.",
  provider_unavailable: "The AI service is busy. Try again in a moment.",
  invalid_output: "The AI returned an unusable result. Try again.",
  invalid_input: "That request couldn't be processed. Check the text and try again.",
  timeout: "The AI took too long to respond. Try again.",
  aborted: "Generation cancelled.",
  unknown: "Something went wrong generating that. Try again.",
};

/** Codes where retrying the identical request is reasonable. */
const RETRYABLE: ReadonlySet<AiErrorCode> = new Set<AiErrorCode>([
  "provider_unavailable",
  "invalid_output",
  "timeout",
  "unknown",
]);

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly retryable: boolean;

  constructor(code: AiErrorCode, options?: { message?: string; cause?: unknown }) {
    super(options?.message ?? AI_ERROR_MESSAGES[code], { cause: options?.cause });

    this.name = "AiError";
    this.code = code;
    this.retryable = RETRYABLE.has(code);
  }
}

/**
 * Narrows an unknown throw into an `AiError`.
 *
 * The mapping is ordered by specificity: our own errors pass through untouched,
 * then abort (which arrives as a `DOMException`, not an SDK error), then the SDK's
 * shapes. `RetryError` is unwrapped because the SDK has already exhausted its
 * retries by the time it surfaces — what matters is the last underlying cause.
 */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) {
    return error;
  }

  if (isAbort(error)) {
    return new AiError("aborted", { cause: error });
  }

  if (isTimeout(error)) {
    return new AiError("timeout", { cause: error });
  }

  if (RetryError.isInstance(error)) {
    const last = error.errors.at(-1);

    return last === undefined
      ? new AiError("provider_unavailable", { cause: error })
      : toAiError(last);
  }

  // The model answered, but not in a shape the schema accepts. Distinct from a
  // provider failure: the request succeeded and was billed, so the ledger records
  // it and the UI offers regenerate rather than "service unavailable".
  if (NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error)) {
    return new AiError("invalid_output", { cause: error });
  }

  if (APICallError.isInstance(error)) {
    // 429 and 5xx are the provider's problem and worth retrying; a 400 is ours and
    // is not, but neither distinction should leak the provider's message.
    if (error.statusCode === 401 || error.statusCode === 403) {
      return new AiError("not_configured", { cause: error });
    }

    if (error.statusCode === 429 || error.isRetryable) {
      return new AiError("provider_unavailable", { cause: error });
    }

    return new AiError("invalid_input", { cause: error });
  }

  return new AiError("unknown", { cause: error });
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

/**
 * The SDK's `timeout` setting rejects with a plain error rather than a typed
 * class, so this matches on the message. Narrow on purpose: a false positive here
 * would relabel an unrelated failure.
 */
function isTimeout(error: unknown): boolean {
  return error instanceof Error && /timed?\s*out/i.test(error.message);
}
