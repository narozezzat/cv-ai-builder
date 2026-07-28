/**
 * `skills.suggest`, `keywords.generate`, `jobTitles.suggest`.
 *
 * All three are cheap, list-shaped, and additive: nothing here replaces the user's
 * text, so the popover offers them as checkboxes rather than as a diff.
 */

import "server-only";

import { z } from "zod";

import { RESUME_LIMITS } from "@/types/resume";
import type { AiTask } from "../run";
import {
  AI_INPUT_LIMITS,
  block,
  experienceEntrySchema,
  keywordText,
  optionalText,
  outputKeyword,
  outputText,
  renderContext,
  renderExperience,
  requiredText,
  resumeContextSchema,
} from "./shared";

// ---------------------------------------------------------------------------
// skills.suggest
// ---------------------------------------------------------------------------

const skillsInputSchema = z.object({
  context: resumeContextSchema,
  experience: z.array(experienceEntrySchema).max(12).default([]),
  /** Categories the user already uses, so suggestions land in their grouping. */
  existingCategories: z.array(keywordText).max(AI_INPUT_LIMITS.listItems).default([]),
});

const skillsOutputSchema = z.object({
  skills: z
    .array(
      z.object({
        name: outputText(RESUME_LIMITS.nameText),
        /** Groups the skill in every layout; free text, matched to the user's own. */
        category: outputText(RESUME_LIMITS.nameText),
        /**
         * Whether the candidate's history supports the skill, or whether it is a gap
         * worth closing. The UI separates the two — presenting an aspirational skill
         * as an evidenced one is how a resume acquires a claim its owner cannot back.
         */
        evidenced: z.boolean(),
      }),
    )
    .min(3)
    .max(20),
});

export type SkillsSuggestInput = z.infer<typeof skillsInputSchema>;
export type SkillsSuggestOutput = z.infer<typeof skillsOutputSchema>;

export const skillsSuggestTask: AiTask<SkillsSuggestInput, SkillsSuggestOutput> = {
  capability: "skills.suggest",
  inputSchema: skillsInputSchema,
  outputSchema: skillsOutputSchema,
  rules: [
    "Suggest skills worth listing for the target role.",
    "Set `evidenced` true only when the supplied history clearly demonstrates the skill; otherwise false.",
    "Name concrete tools, technologies, and methods. Skip vague traits like 'hard-working' or 'team player'.",
    "Group under the candidate's existing categories where one fits, rather than inventing a parallel name for it.",
    "Never repeat a skill already on the resume.",
  ],
  prompt: (input) =>
    [
      renderContext(input.context),
      input.existingCategories.length > 0
        ? `Categories in use: ${input.existingCategories.join(", ")}`
        : null,
      block("Work history", renderExperience(input.experience)),
    ]
      .filter((part): part is string => part !== null)
      .join("\n\n"),
};

// ---------------------------------------------------------------------------
// keywords.generate
// ---------------------------------------------------------------------------

const keywordsInputSchema = z.object({
  context: resumeContextSchema,
  /** Free text describing what the keywords are for: a role, a section, a posting. */
  subject: requiredText(RESUME_LIMITS.sectionRichText),
});

const keywordsOutputSchema = z.object({
  keywords: z.array(outputKeyword).min(5).max(30),
});

export type KeywordsGenerateInput = z.infer<typeof keywordsInputSchema>;
export type KeywordsGenerateOutput = z.infer<typeof keywordsOutputSchema>;

export const keywordsGenerateTask: AiTask<KeywordsGenerateInput, KeywordsGenerateOutput> = {
  capability: "keywords.generate",
  inputSchema: keywordsInputSchema,
  outputSchema: keywordsOutputSchema,
  rules: [
    "List the terms an applicant tracking system and a recruiter would both scan for.",
    "Use the industry's own wording, including the spelled-out form of an acronym where both are searched.",
    "One concept per keyword, no duplicates, no sentences.",
    "Order by how much a match on the term would matter.",
  ],
  prompt: (input) => [renderContext(input.context), block("Subject", input.subject)].join("\n\n"),
};

// ---------------------------------------------------------------------------
// jobTitles.suggest
// ---------------------------------------------------------------------------

const jobTitlesInputSchema = z.object({
  context: resumeContextSchema,
  currentTitle: optionalText(RESUME_LIMITS.shortText),
  experience: z.array(experienceEntrySchema).max(12).default([]),
});

const jobTitlesOutputSchema = z.object({
  titles: z
    .array(
      z.object({
        title: outputText(RESUME_LIMITS.shortText),
        /** One line on why it fits, since a title change is a claim about seniority. */
        rationale: outputText(RESUME_LIMITS.highlightText),
      }),
    )
    .min(3)
    .max(8),
});

export type JobTitlesSuggestInput = z.infer<typeof jobTitlesInputSchema>;
export type JobTitlesSuggestOutput = z.infer<typeof jobTitlesOutputSchema>;

export const jobTitlesSuggestTask: AiTask<JobTitlesSuggestInput, JobTitlesSuggestOutput> = {
  capability: "jobTitles.suggest",
  inputSchema: jobTitlesInputSchema,
  outputSchema: jobTitlesOutputSchema,
  rules: [
    "Suggest job titles this candidate is a credible applicant for.",
    "Use titles that are actually posted in the industry, not internal or invented ones.",
    "Do not inflate seniority beyond what the history supports; a title the candidate cannot defend in an interview costs them the interview.",
    "Keep each rationale to one sentence, pointing at the evidence for the fit.",
  ],
  prompt: (input) =>
    [
      renderContext(input.context),
      input.currentTitle ? `Current title: ${input.currentTitle}` : null,
      block("Work history", renderExperience(input.experience)),
    ]
      .filter((part): part is string => part !== null)
      .join("\n\n"),
};
