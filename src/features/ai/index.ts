/**
 * Public surface of the AI feature.
 *
 * One rule governs what may be listed here: **no module in this graph may import a
 * `server-only` value at module scope.** Every client component that reads even a type
 * from this barrel pulls the whole barrel into the client graph, so a single such
 * import would fail the build for all of them.
 *
 * That is why the exports are limited to three kinds:
 *
 * - the `"use server"` actions, which Next replaces with action references rather
 *   than bundling — the one legitimate way a client component reaches server code;
 * - the suggestion popover and its types, which are client components and plain data;
 * - `lib/*`, which is pure: result narrowing, suggestion shapes, and the merge rules
 *   that decide what accepting a list suggestion actually writes.
 *
 * `@/services/ai` is *not* re-exported. Prompt input and output types are imported
 * from there directly, with `import type`, which erases.
 */

export {
  bulletsFromParagraphAction,
  explainJobGapsAction,
  extractJobRequirementsAction,
  fixGrammarAction,
  generateCoverLetterAction,
  generateKeywordsAction,
  generateSummaryAction,
  improveBulletsAction,
  rewriteExperienceAction,
  rewriteForAtsAction,
  suggestAchievementsAction,
  suggestJobTitlesAction,
  suggestProjectsAction,
  suggestSkillsAction,
  tailorToCompanyAction,
} from "./actions/ai-actions";

export { AiFailureNotice } from "./components/ai-failure-notice";
export type { AiFailureNoticeProps } from "./components/ai-failure-notice";

export { AiSuggestionPopover } from "./components/ai-suggestion-popover";
export type { AiAcceptPayload, AiSuggestionPopoverProps } from "./components/ai-suggestion-popover";

export { isAiActionFailure } from "./lib/ai-action-result";
export type {
  AiActionFailure,
  AiActionOptions,
  AiActionResult,
  AiActionSuccess,
} from "./lib/ai-action-result";

export { mergeListItems, suggestionId } from "./lib/suggestion";
export type { AiSuggestion, ListSuggestion, TextSuggestion } from "./lib/suggestion";
