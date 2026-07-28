/**
 * The three text transformers: `text.grammar`, `text.atsRewrite`,
 * `text.tailorToCompany`.
 *
 * All three take one field's text and return one field's text, which is what lets a
 * single `AISuggestionPopover` drive them from anywhere in the editor. Each also
 * returns a short list of what it changed and why: a rewrite the user cannot audit
 * is a rewrite they have to either trust blindly or discard.
 */

import "server-only";

import { z } from "zod";

import { RESUME_LIMITS } from "@/types/resume";
import type { AiTask } from "../run";
import {
  AI_INPUT_LIMITS,
  block,
  keywordText,
  optionalText,
  outputBullet,
  outputKeyword,
  outputText,
  renderContext,
  requiredText,
  resumeContextSchema,
} from "./shared";

/** Every transformer works on a field's worth of text. */
const outputFieldText = outputText(AI_INPUT_LIMITS.fieldText);

// ---------------------------------------------------------------------------
// text.grammar — corrections only.
// ---------------------------------------------------------------------------

const grammarInputSchema = z.object({
  text: requiredText(AI_INPUT_LIMITS.fieldText),
});

const grammarOutputSchema = z.object({
  text: outputFieldText,
  corrections: z
    .array(
      z.object({
        before: outputText(RESUME_LIMITS.highlightText),
        after: outputText(RESUME_LIMITS.highlightText),
        reason: outputText(RESUME_LIMITS.highlightText),
      }),
    )
    .max(30),
});

export type TextGrammarInput = z.infer<typeof grammarInputSchema>;
export type TextGrammarOutput = z.infer<typeof grammarOutputSchema>;

export const textGrammarTask: AiTask<TextGrammarInput, TextGrammarOutput> = {
  capability: "text.grammar",
  inputSchema: grammarInputSchema,
  outputSchema: grammarOutputSchema,
  rules: [
    "Correct grammar, spelling, punctuation, and tense consistency. Nothing else.",
    "This is a proofread, not an edit: leave word choice, sentence structure, and voice alone even where you would have written them differently.",
    "Fix the spelling convention only where it is inconsistent with the requested one.",
    "Preserve line breaks, list markers, and capitalisation of names and technologies exactly.",
    "List each correction with the original fragment, the replacement, and a short reason. Return an empty list if the text was already correct.",
  ],
  // Deliberately no style context: tone and verbosity guidance still arrives through
  // the shared instructions, and a proofread that is also nudged toward "impactful"
  // stops being a proofread.
  prompt: (input) => block("Text to proofread", input.text),
};

// ---------------------------------------------------------------------------
// text.atsRewrite — same claims, machine-readable.
// ---------------------------------------------------------------------------

const atsInputSchema = z.object({
  context: resumeContextSchema,
  text: requiredText(AI_INPUT_LIMITS.fieldText),
  /** Terms the target posting uses, when the user came from a match report. */
  targetKeywords: z.array(keywordText).max(AI_INPUT_LIMITS.listItems).default([]),
});

const atsOutputSchema = z.object({
  text: outputFieldText,
  /** Which target terms the rewrite managed to work in, truthfully. */
  keywordsUsed: z.array(outputKeyword).max(30),
  /** Terms deliberately left out because the text does not support them. */
  keywordsSkipped: z.array(outputKeyword).max(30),
});

export type TextAtsRewriteInput = z.infer<typeof atsInputSchema>;
export type TextAtsRewriteOutput = z.infer<typeof atsOutputSchema>;

export const textAtsRewriteTask: AiTask<TextAtsRewriteInput, TextAtsRewriteOutput> = {
  capability: "text.atsRewrite",
  inputSchema: atsInputSchema,
  outputSchema: atsOutputSchema,
  rules: [
    "Rewrite the text so an applicant tracking system parses it cleanly and a human still wants to read it.",
    "Use plain sentences and standard industry terms. No tables, columns, symbols, emoji, or decorative characters.",
    "Work in a target keyword only where the text already supports the claim. List the rest under `keywordsSkipped` — padding a resume with unsupported terms fails the interview it wins.",
    "Spell out an acronym on first use and keep the acronym alongside it.",
    "Keep every metric and proper noun from the original.",
  ],
  prompt: (input) =>
    [
      renderContext(input.context),
      input.targetKeywords.length > 0
        ? `Target keywords: ${input.targetKeywords.join(", ")}`
        : "No target keywords supplied — use the terms standard for the target role.",
      block("Text to rewrite", input.text),
    ].join("\n\n"),
};

// ---------------------------------------------------------------------------
// text.tailorToCompany
// ---------------------------------------------------------------------------

const tailorInputSchema = z.object({
  context: resumeContextSchema,
  text: requiredText(AI_INPUT_LIMITS.fieldText),
  company: requiredText(RESUME_LIMITS.nameText),
  /** What the user knows about the company. The model gets no other source. */
  companyNotes: optionalText(AI_INPUT_LIMITS.fieldText),
  jobTitle: optionalText(RESUME_LIMITS.shortText),
});

const tailorOutputSchema = z.object({
  text: outputFieldText,
  /** What was emphasised or de-emphasised, so the change is reviewable. */
  changes: z.array(outputBullet).max(10),
});

export type TextTailorInput = z.infer<typeof tailorInputSchema>;
export type TextTailorOutput = z.infer<typeof tailorOutputSchema>;

export const textTailorToCompanyTask: AiTask<TextTailorInput, TextTailorOutput> = {
  capability: "text.tailorToCompany",
  inputSchema: tailorInputSchema,
  outputSchema: tailorOutputSchema,
  rules: [
    "Re-angle the text for one named company: lead with what that company would care about most.",
    "Tailoring is emphasis, not addition. Reorder, foreground, and rephrase — never add experience the text does not contain.",
    // The model's training data is not a fact source about a specific employer, and
    // a confidently wrong claim about the company reaches the hiring manager who
    // knows better than anyone that it is wrong.
    "Use only the supplied notes as facts about the company. If none are supplied, tailor to the role and industry and do not assert anything specific about the company.",
    "Avoid flattery aimed at the company. The subject is the candidate.",
    "Summarise what you changed as short bullets.",
  ],
  prompt: (input) =>
    [
      renderContext(input.context),
      `Target company: ${input.company}`,
      input.jobTitle ? `Target job title: ${input.jobTitle}` : null,
      input.companyNotes
        ? block("What the candidate knows about the company", input.companyNotes)
        : "No company notes supplied.",
      block("Text to tailor", input.text),
    ]
      .filter((part): part is string => part !== null)
      .join("\n\n"),
};
