/**
 * `projects.suggest`.
 *
 * This suggests projects the candidate could *build*, not projects to claim they
 * already built. A capability that filled the Projects section with plausible
 * fabrications would be a résumé-fraud generator with a friendly button, so the
 * output is shaped as a plan — name, what it demonstrates, what to build — and the
 * UI presents it as a to-do list rather than as insertable section items.
 */

import "server-only";

import { z } from "zod";

import { RESUME_LIMITS } from "@/types/resume";
import type { AiTask } from "../run";
import {
  AI_INPUT_LIMITS,
  block,
  keywordText,
  outputBullet,
  outputKeyword,
  outputText,
  renderContext,
  requiredText,
  resumeContextSchema,
} from "./shared";

const inputSchema = z.object({
  context: resumeContextSchema,
  /** Projects already listed, by name, so suggestions do not duplicate them. */
  existingProjects: z
    .array(requiredText(RESUME_LIMITS.nameText))
    .max(AI_INPUT_LIMITS.listItems)
    .default([]),
  /** Skills the candidate wants to prove — usually the gaps from a match report. */
  targetSkills: z.array(keywordText).max(AI_INPUT_LIMITS.listItems).default([]),
});

const outputSchema = z.object({
  projects: z
    .array(
      z.object({
        name: outputText(RESUME_LIMITS.nameText),
        /** What it is, in the register the Projects section uses. */
        description: outputText(RESUME_LIMITS.itemRichText),
        /** The gap it closes — why building this is worth the weekend. */
        demonstrates: z.array(outputKeyword).min(1).max(8),
        technologies: z.array(outputKeyword).max(12),
        /** Concrete first steps, so the suggestion is actionable rather than a wish. */
        steps: z.array(outputBullet).min(2).max(6),
        effort: z.enum(["weekend", "week", "month"]),
      }),
    )
    .min(2)
    .max(5),
});

export type ProjectsSuggestInput = z.infer<typeof inputSchema>;
export type ProjectsSuggestOutput = z.infer<typeof outputSchema>;

export const projectsSuggestTask: AiTask<ProjectsSuggestInput, ProjectsSuggestOutput> = {
  capability: "projects.suggest",
  inputSchema,
  outputSchema,
  rules: [
    "Propose portfolio projects the candidate could build to strengthen this resume for the target role.",
    "These are proposals, not history. Never phrase one as something already completed.",
    "Each project must be finishable by one person and must produce something demonstrable — a URL, a repo, a write-up.",
    "Prefer projects that close the stated skill gaps over projects that repeat what the candidate has already proven.",
    "Be specific enough to start: 'a rate-limited URL shortener with a Postgres backend', not 'a web app'.",
    "Size `effort` honestly against the scope you described.",
  ],
  prompt: (input) =>
    [
      renderContext(input.context),
      input.targetSkills.length > 0
        ? `Skills to demonstrate: ${input.targetSkills.join(", ")}`
        : "No specific skill gaps supplied — infer them from the target role.",
      input.existingProjects.length > 0
        ? block(
            "Projects already listed (do not repeat)",
            input.existingProjects.map((name) => `- ${name}`).join("\n"),
          )
        : null,
    ]
      .filter((part): part is string => part !== null)
      .join("\n\n"),
};
