/**
 * The work-history capabilities: `experience.rewrite`, `bullets.improve`,
 * `bullets.fromParagraph`, `achievements.suggest`.
 *
 * `bullets.improve` returns index-addressed results rather than a bare array. A
 * positional array would rely on the model preserving both order and count to stay
 * aligned with what the user selected, and a model that drops one silently shifts
 * every later improvement onto the wrong bullet — which the diff view would then
 * present as a confident rewrite of a line the user never touched.
 */

import "server-only";

import { z } from "zod";

import { RESUME_LIMITS } from "@/types/resume";
import type { AiTask } from "../run";
import {
  AI_INPUT_LIMITS,
  BULLET_RULES,
  block,
  keywordText,
  optionalText,
  outputBullet,
  outputKeyword,
  outputParagraph,
  renderContext,
  requiredText,
  resumeContextSchema,
} from "./shared";

// ---------------------------------------------------------------------------
// experience.rewrite — one job, rewritten whole.
// ---------------------------------------------------------------------------

const roleSchema = z.object({
  position: requiredText(RESUME_LIMITS.shortText),
  company: optionalText(RESUME_LIMITS.nameText),
  period: optionalText(RESUME_LIMITS.shortText),
  /** The user's existing prose for the role, if any. */
  summary: optionalText(RESUME_LIMITS.itemRichText),
  highlights: z.array(requiredText(RESUME_LIMITS.highlightText)).max(30).default([]),
  technologies: z.array(keywordText).max(AI_INPUT_LIMITS.listItems).default([]),
});

const rewriteInputSchema = z.object({
  context: resumeContextSchema,
  role: roleSchema,
});

const rewriteOutputSchema = z.object({
  /** One or two sentences of scope-setting prose. Null when bullets say it all. */
  summary: outputParagraph.nullable(),
  bullets: z.array(outputBullet).min(3).max(6),
});

export type ExperienceRewriteInput = z.infer<typeof rewriteInputSchema>;
export type ExperienceRewriteOutput = z.infer<typeof rewriteOutputSchema>;

export const experienceRewriteTask: AiTask<ExperienceRewriteInput, ExperienceRewriteOutput> = {
  capability: "experience.rewrite",
  inputSchema: rewriteInputSchema,
  outputSchema: rewriteOutputSchema,
  rules: [
    "Rewrite one role's description so a recruiter grasps its scope and impact in seconds.",
    ...BULLET_RULES,
    "Return 3 to 6 bullets, ordered most impressive first.",
    "Use `summary` only for scope a bullet cannot carry — team size, remit, product surface. Return null otherwise.",
    "Preserve every technology the candidate listed that the rewrite still supports.",
  ],
  prompt: (input) =>
    [
      renderContext(input.context),
      `Role: ${[input.role.position, input.role.company, input.role.period].filter(Boolean).join(" — ")}`,
      input.role.technologies.length > 0
        ? `Technologies used: ${input.role.technologies.join(", ")}`
        : null,
      input.role.summary ? block("Existing description", input.role.summary) : null,
      input.role.highlights.length > 0
        ? block("Existing bullets", input.role.highlights.map((line) => `- ${line}`).join("\n"))
        : null,
      input.role.summary || input.role.highlights.length > 0
        ? "Rewrite the above. Keep the facts; change the wording."
        : "The role has no description yet. Write one from the title and technologies alone, and do not invent achievements.",
    ]
      .filter((part): part is string => part !== null)
      .join("\n\n"),
};

// ---------------------------------------------------------------------------
// bullets.improve — sharpen bullets the user picked.
// ---------------------------------------------------------------------------

const improveInputSchema = z.object({
  context: resumeContextSchema,
  /** Context for the bullets: which role they belong to. */
  roleTitle: optionalText(RESUME_LIMITS.shortText),
  bullets: z.array(requiredText(RESUME_LIMITS.highlightText)).min(1).max(12),
});

const improveOutputSchema = z.object({
  bullets: z.array(
    z.object({
      /**
       * Zero-based position in the submitted list. The schema cannot bound this
       * against the input it came from, so the caller drops indexes it did not send
       * rather than trusting the echo.
       */
      index: z.number().int().min(0),
      text: outputBullet,
    }),
  ),
});

export type BulletsImproveInput = z.infer<typeof improveInputSchema>;
export type BulletsImproveOutput = z.infer<typeof improveOutputSchema>;

export const bulletsImproveTask: AiTask<BulletsImproveInput, BulletsImproveOutput> = {
  capability: "bullets.improve",
  inputSchema: improveInputSchema,
  outputSchema: improveOutputSchema,
  rules: [
    "Improve each supplied bullet in place. One improvement per input bullet, no merging, no splitting.",
    "Echo back the zero-based index of the bullet each improvement replaces.",
    ...BULLET_RULES,
    "Keep any metric the original contains, exactly as written.",
    "If a bullet is already strong, return it materially unchanged rather than paraphrasing it for the sake of change.",
  ],
  prompt: (input) =>
    [
      renderContext(input.context),
      input.roleTitle ? `These bullets belong to the role: ${input.roleTitle}` : null,
      block(
        "Bullets, one per line, prefixed by index",
        input.bullets.map((line, index) => `${index}: ${line}`).join("\n"),
      ),
    ]
      .filter((part): part is string => part !== null)
      .join("\n\n"),
};

// ---------------------------------------------------------------------------
// bullets.fromParagraph — prose the user pasted, turned into bullets.
// ---------------------------------------------------------------------------

const fromParagraphInputSchema = z.object({
  context: resumeContextSchema,
  paragraph: requiredText(AI_INPUT_LIMITS.fieldText),
});

const fromParagraphOutputSchema = z.object({
  bullets: z.array(outputBullet).min(2).max(8),
});

export type BulletsFromParagraphInput = z.infer<typeof fromParagraphInputSchema>;
export type BulletsFromParagraphOutput = z.infer<typeof fromParagraphOutputSchema>;

export const bulletsFromParagraphTask: AiTask<
  BulletsFromParagraphInput,
  BulletsFromParagraphOutput
> = {
  capability: "bullets.fromParagraph",
  inputSchema: fromParagraphInputSchema,
  outputSchema: fromParagraphOutputSchema,
  rules: [
    "Split the supplied paragraph into resume bullets.",
    "This is a restructuring, not a rewrite: every bullet must trace to something the paragraph says.",
    "Drop nothing of substance and add nothing new. If the paragraph holds one idea, return one strong bullet rather than padding to a count.",
    ...BULLET_RULES,
  ],
  prompt: (input) =>
    [renderContext(input.context), block("Paragraph to convert", input.paragraph)].join("\n\n"),
};

// ---------------------------------------------------------------------------
// achievements.suggest — what the candidate could add, honestly.
// ---------------------------------------------------------------------------

const achievementsInputSchema = z.object({
  context: resumeContextSchema,
  roleTitle: requiredText(RESUME_LIMITS.shortText),
  company: optionalText(RESUME_LIMITS.nameText),
  existingHighlights: z.array(requiredText(RESUME_LIMITS.highlightText)).max(30).default([]),
});

const achievementsOutputSchema = z.object({
  achievements: z.array(outputBullet).min(3).max(8),
  /** The metrics worth chasing, so the user knows what to go and look up. */
  metricsToGather: z.array(outputKeyword).max(8),
});

export type AchievementsSuggestInput = z.infer<typeof achievementsInputSchema>;
export type AchievementsSuggestOutput = z.infer<typeof achievementsOutputSchema>;

export const achievementsSuggestTask: AiTask<AchievementsSuggestInput, AchievementsSuggestOutput> =
  {
    capability: "achievements.suggest",
    inputSchema: achievementsInputSchema,
    outputSchema: achievementsOutputSchema,
    rules: [
      "Suggest achievements typical of this role that the candidate has not listed, as templates for them to confirm or discard.",
      // The house rules forbid inventing metrics; a bracketed placeholder is the
      // honest alternative. It reads as a blank to fill rather than as a fact, which
      // is exactly what an unverified number is.
      "Where a number would carry the achievement, leave a bracketed placeholder — [X%], [N], [$X] — never a guessed figure.",
      ...BULLET_RULES,
      "Do not restate anything already in the candidate's bullets.",
      "`metricsToGather` names the measurements behind the suggestions, e.g. 'deployment frequency', 'support ticket volume'.",
    ],
    prompt: (input) =>
      [
        renderContext(input.context),
        `Role: ${[input.roleTitle, input.company].filter(Boolean).join(" at ")}`,
        input.existingHighlights.length > 0
          ? block(
              "Already listed (do not repeat)",
              input.existingHighlights.map((line) => `- ${line}`).join("\n"),
            )
          : "Nothing listed for this role yet.",
      ].join("\n\n"),
  };
