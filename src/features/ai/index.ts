/**
 * Public surface of the AI feature.
 *
 * Two kinds of module only: the `"use server"` actions, which Next replaces with
 * action references when a client component imports them, and `lib/ai-action-result`,
 * which holds no value that touches `server-only`. Adding a third — anything that
 * imports a `server-only` value at module scope — would make this barrel throw at
 * build time for every client component that reads a type from it.
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

export { isAiActionFailure } from "./lib/ai-action-result";
export type {
  AiActionFailure,
  AiActionOptions,
  AiActionResult,
  AiActionSuccess,
} from "./lib/ai-action-result";
