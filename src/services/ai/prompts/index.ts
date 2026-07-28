/**
 * The prompt registry.
 *
 * `AI_TASKS` is keyed by `AiCapability` through `satisfies Record<AiCapability, …>`,
 * so adding a capability id without adding its task is a type error rather than a
 * runtime `undefined` discovered by whoever ships the button. The `satisfies` (not a
 * type annotation) keeps each entry's precise input/output types for callers.
 */

import "server-only";

import type { AiCapability } from "../capabilities";
import { coverLetterGenerateTask } from "./cover-letter";
import {
  achievementsSuggestTask,
  bulletsFromParagraphTask,
  bulletsImproveTask,
  experienceRewriteTask,
} from "./experience";
import { jobMatchExtractTask, jobMatchGapsTask } from "./job-match";
import { projectsSuggestTask } from "./projects";
import { jobTitlesSuggestTask, keywordsGenerateTask, skillsSuggestTask } from "./skills";
import { summaryGenerateTask } from "./summary";
import { textAtsRewriteTask, textGrammarTask, textTailorToCompanyTask } from "./text";

export const AI_TASKS = {
  "summary.generate": summaryGenerateTask,
  "experience.rewrite": experienceRewriteTask,
  "bullets.improve": bulletsImproveTask,
  "bullets.fromParagraph": bulletsFromParagraphTask,
  "achievements.suggest": achievementsSuggestTask,
  "skills.suggest": skillsSuggestTask,
  "projects.suggest": projectsSuggestTask,
  "keywords.generate": keywordsGenerateTask,
  "jobTitles.suggest": jobTitlesSuggestTask,
  "text.grammar": textGrammarTask,
  "text.atsRewrite": textAtsRewriteTask,
  "text.tailorToCompany": textTailorToCompanyTask,
  "coverLetter.generate": coverLetterGenerateTask,
  "jobMatch.extract": jobMatchExtractTask,
  "jobMatch.gaps": jobMatchGapsTask,
} satisfies Record<AiCapability, { capability: AiCapability; rules: readonly string[] }>;

export * from "./shared";
export { coverLetterGenerateTask } from "./cover-letter";
export {
  achievementsSuggestTask,
  bulletsFromParagraphTask,
  bulletsImproveTask,
  experienceRewriteTask,
} from "./experience";
export {
  jobMatchExtractTask,
  jobMatchGapsTask,
  JD_GAP_SEVERITY,
  JD_IMPORTANCE,
  JD_SENIORITY,
} from "./job-match";
export { projectsSuggestTask } from "./projects";
export { jobTitlesSuggestTask, keywordsGenerateTask, skillsSuggestTask } from "./skills";
export { summaryGenerateTask } from "./summary";
export { textAtsRewriteTask, textGrammarTask, textTailorToCompanyTask } from "./text";

export type {
  AchievementsSuggestInput,
  AchievementsSuggestOutput,
  BulletsFromParagraphInput,
  BulletsFromParagraphOutput,
  BulletsImproveInput,
  BulletsImproveOutput,
  ExperienceRewriteInput,
  ExperienceRewriteOutput,
} from "./experience";
export type { CoverLetterInput, CoverLetterOutput } from "./cover-letter";
export type {
  JobMatchExtractInput,
  JobMatchExtractOutput,
  JobMatchGapsInput,
  JobMatchGapsOutput,
  JobRequirement,
} from "./job-match";
export type { ProjectsSuggestInput, ProjectsSuggestOutput } from "./projects";
export type {
  JobTitlesSuggestInput,
  JobTitlesSuggestOutput,
  KeywordsGenerateInput,
  KeywordsGenerateOutput,
  SkillsSuggestInput,
  SkillsSuggestOutput,
} from "./skills";
export type { SummaryGenerateInput, SummaryGenerateOutput } from "./summary";
export type {
  TextAtsRewriteInput,
  TextAtsRewriteOutput,
  TextGrammarInput,
  TextGrammarOutput,
  TextTailorInput,
  TextTailorOutput,
} from "./text";
