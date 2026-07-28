/**
 * `coverLetter.generate`.
 *
 * Returned as parts — greeting, body paragraphs, closing — rather than one blob.
 * The user edits the middle far more often than the ends, and a structured letter
 * can be rendered into the editor, a PDF, or an email body without re-parsing prose
 * to find the paragraph boundaries.
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
  outputText,
  renderContext,
  renderExperience,
  requiredText,
  resumeContextSchema,
} from "./shared";

const inputSchema = z.object({
  context: resumeContextSchema,
  candidateName: requiredText(RESUME_LIMITS.nameText),
  company: requiredText(RESUME_LIMITS.nameText),
  jobTitle: requiredText(RESUME_LIMITS.shortText),
  /** The posting, when the user has it. Worth more than any other input here. */
  jobDescription: optionalText(AI_INPUT_LIMITS.jobDescription),
  hiringManager: optionalText(RESUME_LIMITS.nameText),
  summary: optionalText(RESUME_LIMITS.sectionRichText),
  experience: z.array(experienceEntrySchema).max(8).default([]),
  skills: z.array(keywordText).max(AI_INPUT_LIMITS.listItems).default([]),
});

const outputSchema = z.object({
  /** For the email that carries the letter. */
  subject: outputText(RESUME_LIMITS.shortText),
  greeting: outputText(RESUME_LIMITS.shortText),
  /** One string per paragraph, in order. Three or four is a letter; six is an essay. */
  paragraphs: z.array(outputText(RESUME_LIMITS.itemRichText)).min(3).max(5),
  closing: outputText(RESUME_LIMITS.shortText),
});

export type CoverLetterInput = z.infer<typeof inputSchema>;
export type CoverLetterOutput = z.infer<typeof outputSchema>;

export const coverLetterGenerateTask: AiTask<CoverLetterInput, CoverLetterOutput> = {
  capability: "coverLetter.generate",
  inputSchema,
  outputSchema,
  rules: [
    "Write a cover letter for one named role at one named company.",
    "Structure: an opening that states the role and the single strongest reason to read on; one or two paragraphs of specific evidence drawn from the history; a close that asks for the conversation.",
    "Total length 250 to 350 words. A cover letter nobody finishes reading is a cover letter that did not run.",
    "Every claim must trace to the supplied resume material. No invented achievements, employers, or motivations.",
    "Name the company in the opening paragraph and never refer to it as 'your company' thereafter.",
    "No clichés: not 'I am writing to apply', not 'I believe I would be a great fit', not 'passionate about'.",
    "Address the hiring manager by name when one is supplied; otherwise 'Dear Hiring Team' — never 'Dear Sir or Madam'.",
    "`closing` is the sign-off line only, e.g. 'Sincerely,'. Do not include the candidate's name in it.",
  ],
  prompt: (input) =>
    [
      renderContext(input.context),
      `Candidate: ${input.candidateName}`,
      `Applying for: ${input.jobTitle} at ${input.company}`,
      input.hiringManager ? `Hiring manager: ${input.hiringManager}` : "Hiring manager: unknown.",
      input.skills.length > 0 ? `Skills: ${input.skills.join(", ")}` : null,
      input.summary ? block("Candidate summary", input.summary) : null,
      block("Work history", renderExperience(input.experience)),
      input.jobDescription
        ? block("Job description", input.jobDescription)
        : "No job description supplied — write to the role title and industry.",
    ]
      .filter((part): part is string => part !== null)
      .join("\n\n"),
};
