/**
 * `summary.generate` — the professional summary at the top of the resume.
 *
 * Returns three variants for one charge rather than one. The popover's "regenerate"
 * would otherwise be a second billed call to answer the same question, and a user
 * comparing three openings picks a better one than a user accepting the first.
 */

import "server-only";

import { z } from "zod";

import { RESUME_LIMITS } from "@/types/resume";
import type { AiTask } from "../run";
import {
  block,
  experienceEntrySchema,
  optionalText,
  outputKeyword,
  outputText,
  renderContext,
  renderExperience,
  resumeContextSchema,
} from "./shared";

const inputSchema = z.object({
  context: resumeContextSchema,
  /** Present when the user already wrote one and wants it sharpened, not replaced. */
  currentSummary: optionalText(RESUME_LIMITS.sectionRichText),
  yearsExperience: z.number().int().min(0).max(70).optional(),
  experience: z.array(experienceEntrySchema).max(12).default([]),
});

const outputSchema = z.object({
  variants: z.array(outputText(RESUME_LIMITS.sectionRichText)).min(1).max(3),
  /** Surfaced under the suggestion so the user can see what it is optimising for. */
  keywords: z.array(outputKeyword).max(12),
});

export type SummaryGenerateInput = z.infer<typeof inputSchema>;
export type SummaryGenerateOutput = z.infer<typeof outputSchema>;

export const summaryGenerateTask: AiTask<SummaryGenerateInput, SummaryGenerateOutput> = {
  capability: "summary.generate",
  inputSchema,
  outputSchema,
  rules: [
    "Write a professional summary for the top of a resume.",
    "Return exactly three distinct variants: one achievement-led, one skills-led, one narrative.",
    "Open with the candidate's professional identity, never with 'I am' or their name.",
    "Ground every claim in the supplied history. No aspirational statements about the future.",
    "Include the strongest keywords a recruiter would scan for, worked into sentences rather than listed.",
  ],
  prompt: (input) =>
    [
      renderContext(input.context),
      input.yearsExperience !== undefined ? `Years of experience: ${input.yearsExperience}` : null,
      block("Work history", renderExperience(input.experience)),
      input.currentSummary
        ? block(
            "Current summary to improve (keep its facts, raise its impact)",
            input.currentSummary,
          )
        : "The candidate has no summary yet. Write one from the history above.",
    ]
      .filter((part): part is string => part !== null)
      .join("\n\n"),
};
