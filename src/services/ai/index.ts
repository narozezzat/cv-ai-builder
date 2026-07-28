/**
 * The AI service's public surface.
 *
 * Server-only, all of it: features import `runAiTask` and a task, never a provider
 * client. `guardAiRequest` and `chargeCredits` are exported for tests and for the
 * credits UI, not as an alternative entry point — a capability that guards and then
 * calls a model itself skips the metering and the ledger row that `runAiTask` writes.
 */

import "server-only";

export {
  AI_CAPABILITIES,
  AI_CAPABILITY_CONFIG,
  AI_RATE_LIMITS,
  AI_RATE_LIMIT_RULES,
} from "./capabilities";
export type { AiCapability, AiCapabilityConfig } from "./capabilities";

export { chargeCredits } from "./credits";

export { AI_ERROR_CODES, AI_ERROR_MESSAGES, AiError, toAiError } from "./errors";
export type { AiErrorCode } from "./errors";

export { guardAiRequest } from "./guard";
export type { AiGuardResult } from "./guard";

export { describeModel, resolveModel } from "./provider";
export type { AiModelTier } from "./provider";

export { runAiTask } from "./run";
export type { AiRunContext, AiRunResult, AiTask } from "./run";

export {
  AI_STYLE_DEFAULTS,
  AI_STYLE_SPELLING,
  AI_STYLE_TONES,
  AI_STYLE_VERBOSITY,
  buildInstructions,
} from "./style";
export type { AiStyle } from "./style";

export * from "./prompts";
