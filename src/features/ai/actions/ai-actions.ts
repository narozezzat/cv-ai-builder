"use server";

/**
 * The fifteen AI capabilities, as server actions.
 *
 * Each one is four lines because all the substance lives in `runAiTask`: input
 * validation, the guard chain, output schema parsing, the ledger row, and the error
 * mapping. An action that reached for `generateText` itself would opt out of all
 * five, so the only job here is the seam — session, writing style, attribution — and
 * turning a thrown `AiError` into something a client component can branch on.
 *
 * SECURITY, in the order it matters:
 *
 * 1. Every export is a public HTTP endpoint. None trusts its argument: the typed
 *    parameter is a courtesy for the caller, and `runAiTask` re-parses the value
 *    against the capability's own input schema before a model sees it.
 * 2. The user id is never an argument. `guardAiRequest` reads it from the session,
 *    which is also what stops an anonymous caller reaching a paid provider.
 * 3. An anonymous caller gets `unauthenticated` back rather than a redirect. These
 *    run from a field in the editor, not from a navigation, so bouncing the user to
 *    the login page mid-sentence would discard unsaved work to say "sign in".
 * 4. `resumeId` is attribution only, so it is checked against RLS before it reaches
 *    the ledger. An id the caller cannot read is rejected rather than quietly
 *    nulled — spend booked against someone else's resume is worse than a failure.
 * 5. Nothing here formats a provider error. `AiError.message` is the fixed,
 *    provider-free sentence from `AI_ERROR_MESSAGES`; the original stays server-side
 *    as `cause`, because provider errors carry request bodies and key fragments.
 */

import { getProfile, parseAiPreferences } from "@/features/profile";
import {
  AiError,
  achievementsSuggestTask,
  bulletsFromParagraphTask,
  bulletsImproveTask,
  coverLetterGenerateTask,
  experienceRewriteTask,
  jobMatchExtractTask,
  jobMatchGapsTask,
  jobTitlesSuggestTask,
  keywordsGenerateTask,
  projectsSuggestTask,
  runAiTask,
  skillsSuggestTask,
  summaryGenerateTask,
  textAtsRewriteTask,
  textGrammarTask,
  textTailorToCompanyTask,
  toAiError,
  type AchievementsSuggestInput,
  type AchievementsSuggestOutput,
  type AiErrorCode,
  type AiStyle,
  type AiTask,
  type BulletsFromParagraphInput,
  type BulletsFromParagraphOutput,
  type BulletsImproveInput,
  type BulletsImproveOutput,
  type CoverLetterInput,
  type CoverLetterOutput,
  type ExperienceRewriteInput,
  type ExperienceRewriteOutput,
  type JobMatchExtractInput,
  type JobMatchExtractOutput,
  type JobMatchGapsInput,
  type JobMatchGapsOutput,
  type JobTitlesSuggestInput,
  type JobTitlesSuggestOutput,
  type KeywordsGenerateInput,
  type KeywordsGenerateOutput,
  type ProjectsSuggestInput,
  type ProjectsSuggestOutput,
  type SkillsSuggestInput,
  type SkillsSuggestOutput,
  type SummaryGenerateInput,
  type SummaryGenerateOutput,
  type TextAtsRewriteInput,
  type TextAtsRewriteOutput,
  type TextGrammarInput,
  type TextGrammarOutput,
  type TextTailorInput,
  type TextTailorOutput,
} from "@/services/ai";
import { createSupabaseServerClient, getCurrentUser } from "@/services/supabase/server";

import { type AiActionOptions, type AiActionResult } from "../lib/ai-action-result";
import { reconcileBulletIndexes } from "../lib/bullet-indexes";

// ── Shared plumbing ───────────────────────────────────────────────────────────

/**
 * Failures that are a fact about the caller's account rather than a fault worth
 * investigating. Logging them would bury the ones that matter under rate limits.
 */
const EXPECTED_FAILURES: ReadonlySet<AiErrorCode> = new Set<AiErrorCode>([
  "unauthenticated",
  "not_configured",
  "rate_limited",
  "insufficient_credits",
  "invalid_input",
  "aborted",
]);

async function runCapability<TInput, TOutput>(
  task: AiTask<TInput, TOutput>,
  input: TInput,
  options: AiActionOptions | undefined,
): Promise<AiActionResult<TOutput>> {
  try {
    // Checked here rather than left to the guard so the anonymous case is one code
    // path: `getProfile` below calls `requireUser`, which redirects.
    if (!(await getCurrentUser())) {
      throw new AiError("unauthenticated");
    }

    const [resumeId, style] = await Promise.all([
      resolveResumeId(options?.resumeId),
      resolveStyle(),
    ]);

    const { data, creditsRemaining } = await runAiTask(task, input, { style, resumeId });

    return { ok: true, data, creditsRemaining };
  } catch (cause) {
    const error = toAiError(cause);

    if (!EXPECTED_FAILURES.has(error.code)) {
      console.error("[ai] capability failed", {
        capability: task.capability,
        code: error.code,
        cause: error.cause instanceof Error ? error.cause.message : error.cause,
      });
    }

    return { ok: false, code: error.code, error: error.message, retryable: error.retryable };
  }
}

/**
 * The caller's writing preferences.
 *
 * `AiPreferences` and `AiStyle` are structurally identical on purpose — `services`
 * may not import `features`, so the two halves are kept in step by a `satisfies` on
 * one side and a union on the other. `getProfile` is `cache()`-memoized, so several
 * AI calls in one request cost one read.
 */
async function resolveStyle(): Promise<AiStyle> {
  const profile = await getProfile();

  return parseAiPreferences(profile?.ai_preferences);
}

/**
 * Confirms the caller can actually see the resume the spend will be booked against.
 *
 * RLS makes someone else's row invisible, so a borrowed id and a nonsense id are the
 * same "not found" — and a malformed uuid comes back as a Postgres error. All three
 * are rejected: `recordAiUsage` writes with the service role, so nothing downstream
 * would catch a foreign id, and the row would attribute this user's credits to a
 * resume they have no relationship with.
 */
async function resolveResumeId(resumeId: string | null | undefined): Promise<string | null> {
  if (!resumeId) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("resumes")
    .select("id")
    .eq("id", resumeId)
    .maybeSingle();

  if (error || !data) {
    throw new AiError("invalid_input");
  }

  return data.id;
}

// ── Summary and experience ────────────────────────────────────────────────────

export async function generateSummaryAction(
  input: SummaryGenerateInput,
  options?: AiActionOptions,
): Promise<AiActionResult<SummaryGenerateOutput>> {
  return runCapability(summaryGenerateTask, input, options);
}

export async function rewriteExperienceAction(
  input: ExperienceRewriteInput,
  options?: AiActionOptions,
): Promise<AiActionResult<ExperienceRewriteOutput>> {
  return runCapability(experienceRewriteTask, input, options);
}

/**
 * Improves a set of bullets, keeping only the indexes this request actually sent.
 *
 * The filter is not defensive tidying: the caller applies each result by index, so an
 * unchecked echo is a write into a field the user did not submit. `input.bullets` is
 * the same array `runAiTask` parsed, so its length is the authority — see
 * `reconcileBulletIndexes`.
 */
export async function improveBulletsAction(
  input: BulletsImproveInput,
  options?: AiActionOptions,
): Promise<AiActionResult<BulletsImproveOutput>> {
  const result = await runCapability(bulletsImproveTask, input, options);

  if (!result.ok) return result;

  return {
    ...result,
    data: { bullets: reconcileBulletIndexes(result.data.bullets, input.bullets.length) },
  };
}

export async function bulletsFromParagraphAction(
  input: BulletsFromParagraphInput,
  options?: AiActionOptions,
): Promise<AiActionResult<BulletsFromParagraphOutput>> {
  return runCapability(bulletsFromParagraphTask, input, options);
}

export async function suggestAchievementsAction(
  input: AchievementsSuggestInput,
  options?: AiActionOptions,
): Promise<AiActionResult<AchievementsSuggestOutput>> {
  return runCapability(achievementsSuggestTask, input, options);
}

// ── Skills, projects, keywords, titles ────────────────────────────────────────

export async function suggestSkillsAction(
  input: SkillsSuggestInput,
  options?: AiActionOptions,
): Promise<AiActionResult<SkillsSuggestOutput>> {
  return runCapability(skillsSuggestTask, input, options);
}

export async function suggestProjectsAction(
  input: ProjectsSuggestInput,
  options?: AiActionOptions,
): Promise<AiActionResult<ProjectsSuggestOutput>> {
  return runCapability(projectsSuggestTask, input, options);
}

export async function generateKeywordsAction(
  input: KeywordsGenerateInput,
  options?: AiActionOptions,
): Promise<AiActionResult<KeywordsGenerateOutput>> {
  return runCapability(keywordsGenerateTask, input, options);
}

export async function suggestJobTitlesAction(
  input: JobTitlesSuggestInput,
  options?: AiActionOptions,
): Promise<AiActionResult<JobTitlesSuggestOutput>> {
  return runCapability(jobTitlesSuggestTask, input, options);
}

// ── Text operations ───────────────────────────────────────────────────────────

export async function fixGrammarAction(
  input: TextGrammarInput,
  options?: AiActionOptions,
): Promise<AiActionResult<TextGrammarOutput>> {
  return runCapability(textGrammarTask, input, options);
}

export async function rewriteForAtsAction(
  input: TextAtsRewriteInput,
  options?: AiActionOptions,
): Promise<AiActionResult<TextAtsRewriteOutput>> {
  return runCapability(textAtsRewriteTask, input, options);
}

export async function tailorToCompanyAction(
  input: TextTailorInput,
  options?: AiActionOptions,
): Promise<AiActionResult<TextTailorOutput>> {
  return runCapability(textTailorToCompanyTask, input, options);
}

// ── Cover letter ──────────────────────────────────────────────────────────────

export async function generateCoverLetterAction(
  input: CoverLetterInput,
  options?: AiActionOptions,
): Promise<AiActionResult<CoverLetterOutput>> {
  return runCapability(coverLetterGenerateTask, input, options);
}

// ── Job matching ──────────────────────────────────────────────────────────────

/**
 * Structured extraction from a pasted job description. Extraction only — the model
 * is never asked for a score, because a hallucinated percentage is unstable across
 * identical inputs and cannot be explained to the user. The match number is computed
 * in TypeScript from this output.
 */
export async function extractJobRequirementsAction(
  input: JobMatchExtractInput,
  options?: AiActionOptions,
): Promise<AiActionResult<JobMatchExtractOutput>> {
  return runCapability(jobMatchExtractTask, input, options);
}

/**
 * The qualitative half of a match report.
 *
 * `matchedKeywords` and `missingKeywords` are inputs, computed by the scorer before
 * this is called. The model explains gaps it is told about; it does not decide what
 * counts as one.
 */
export async function explainJobGapsAction(
  input: JobMatchGapsInput,
  options?: AiActionOptions,
): Promise<AiActionResult<JobMatchGapsOutput>> {
  return runCapability(jobMatchGapsTask, input, options);
}
