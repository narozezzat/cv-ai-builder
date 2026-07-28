/**
 * Schema pieces every capability shares.
 *
 * Two rules hold across all of them:
 *
 * 1. **Outputs are plain text, never HTML.** The editor's rich-text fields hold
 *    TipTap HTML, but a model asked for HTML produces tags the sanitizer then has to
 *    strip, and anything it lets through is markup the model chose. Plain text goes
 *    through the same insert path as typing.
 * 2. **Output bounds mirror `RESUME_LIMITS`.** A suggestion longer than the field it
 *    is destined for is a suggestion the user cannot accept, so the ceiling belongs
 *    on the model's answer rather than on the save that fails afterwards.
 * 3. **Output fields are required, and `.nullable()` where a value may be absent —
 *    never `.optional()` or `.default()`.** Output schemas are translated to a JSON
 *    schema for the provider; strict structured-output modes require every property
 *    to be listed as required, so an optional field is the one thing likely to make
 *    a provider reject the schema outright. Input schemas are ours and have no such
 *    constraint.
 */

import "server-only";

import { z } from "zod";

import { RESUME_LIMITS } from "@/types/resume";

/**
 * Ceilings on what a caller may send. Generous enough for a real resume section and
 * a real job posting, bounded because prompt length is cost and because an unbounded
 * string is an unbounded bill.
 */
export const AI_INPUT_LIMITS = {
  shortText: RESUME_LIMITS.shortText,
  /** One field's worth of text: a summary, a description, a bullet. */
  fieldText: RESUME_LIMITS.sectionRichText,
  /** A pasted job description. Long postings run past 10k characters. */
  jobDescription: 20_000,
  /** How many items a caller may send as context, and get back. */
  listItems: 40,
} as const;

/** Trimmed, non-empty, bounded — the shape almost every text input wants. */
export const requiredText = (max: number) => z.string().trim().min(1).max(max);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

export const keywordText = z.string().trim().min(1).max(RESUME_LIMITS.keywordText);

/**
 * Output strings are deliberately *not* `.trim()`ed.
 *
 * Output schemas are converted to a JSON schema and sent to the provider, and a
 * trim is a value-rewriting check rather than a constraint — nothing in JSON schema
 * expresses it, so it either vanishes in translation or trips the converter. The
 * fields these land in trim on save anyway.
 */
export const outputText = (max: number) => z.string().min(1).max(max);

/** A single generated bullet, bounded to what a highlight field can store. */
export const outputBullet = outputText(RESUME_LIMITS.highlightText);

export const outputKeyword = outputText(RESUME_LIMITS.keywordText);

/** A generated paragraph or description, bounded to one item's rich-text field. */
export const outputParagraph = outputText(RESUME_LIMITS.itemRichText);

/**
 * Who the candidate is aiming to be, in as few tokens as possible.
 *
 * The whole resume document is deliberately *not* the input to a rewrite: it would
 * multiply the prompt cost of every inline action by the size of the user's history,
 * and the model does not need someone's 2014 internship to sharpen one bullet.
 */
export const resumeContextSchema = z.object({
  /** The role being targeted, which is what makes a suggestion relevant. */
  targetRole: optionalText(RESUME_LIMITS.shortText),
  industry: optionalText(RESUME_LIMITS.shortText),
  seniority: optionalText(RESUME_LIMITS.shortText),
  /** Already-listed skills, so suggestions do not duplicate them. */
  existingSkills: z.array(keywordText).max(AI_INPUT_LIMITS.listItems).default([]),
});

export type ResumeContextInput = z.infer<typeof resumeContextSchema>;

/**
 * Renders context as labelled lines rather than prose.
 *
 * SECURITY: these values are user-supplied. Labelled key/value lines keep them
 * visibly *data* — a value that reads like an instruction sits next to a label
 * saying what it is, instead of blending into a sentence the model wrote.
 */
export function renderContext(context: ResumeContextInput): string {
  const lines = [
    context.targetRole ? `Target role: ${context.targetRole}` : null,
    context.industry ? `Industry: ${context.industry}` : null,
    context.seniority ? `Seniority: ${context.seniority}` : null,
    context.existingSkills.length > 0
      ? `Skills already on the resume (do not repeat): ${context.existingSkills.join(", ")}`
      : null,
  ].filter((line): line is string => line !== null);

  return lines.length > 0 ? lines.join("\n") : "No additional context supplied.";
}

/**
 * Wraps untrusted text in a delimited block.
 *
 * The label tells the model what the block is; the fence tells it where the block
 * ends. Neither is a security boundary on its own — `outputSchema` validation in
 * `run.ts` is what makes a successful injection unable to change the response shape
 * — but a delimited block measurably reduces how often a model treats pasted text
 * as an instruction addressed to it.
 */
export function block(label: string, value: string): string {
  return `${label}:\n"""\n${value}\n"""`;
}

/**
 * One job, flattened. Callers pass this instead of `ExperienceItem` so the prompt
 * layer never depends on the document schema's shape — a renamed field in
 * `types/resume.ts` breaks the caller's mapping, which is typed, rather than
 * silently sending `undefined` to a model.
 */
export const experienceEntrySchema = z.object({
  position: requiredText(RESUME_LIMITS.shortText),
  company: optionalText(RESUME_LIMITS.nameText),
  period: optionalText(RESUME_LIMITS.shortText),
  highlights: z
    .array(z.string().trim().min(1).max(RESUME_LIMITS.highlightText))
    .max(20)
    .default([]),
});

export type ExperienceEntryInput = z.infer<typeof experienceEntrySchema>;

export function renderExperience(entries: readonly ExperienceEntryInput[]): string {
  if (entries.length === 0) {
    return "No work history supplied.";
  }

  return entries
    .map((entry) => {
      const heading = [entry.position, entry.company, entry.period]
        .filter((part): part is string => Boolean(part))
        .join(" — ");
      const highlights = entry.highlights.map((line) => `  - ${line}`).join("\n");

      return highlights.length > 0 ? `${heading}\n${highlights}` : heading;
    })
    .join("\n");
}

/** Rules shared by every capability that returns bullet points. */
export const BULLET_RULES = [
  "Each bullet starts with a strong past-tense action verb, unless the role is current.",
  "One idea per bullet: action, then the result it produced.",
  "No pronouns, no articles at the start, no trailing period on fragments.",
  "Do not begin bullets with 'Responsible for' or 'Helped with'.",
] as const;
