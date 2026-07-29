/**
 * The client-side half of the match: what the paste form accepts, and the words the
 * report uses for the scorer's enums.
 *
 * Both halves exist here for the same reason — `@/services/ai` is `server-only`, so a
 * browser module may borrow its *types* (`import type` erases) but never its values.
 * `AI_INPUT_LIMITS.jobDescription` and `JD_SENIORITY` are values, so the cap and the
 * labels are restated locally and pinned by the comments below. If the server schema
 * moves, validation here gets looser or stricter than the action, and the user finds
 * out by spending a request on input the action rejects.
 */

import { z } from "zod";

import type { AtsBand, JdSeniority } from "../lib/ats-score";
import type { ResumeZone } from "../lib/resume-index";

/** Mirrors `AI_INPUT_LIMITS.jobDescription`. Server-side rejection is the backstop. */
export const JOB_DESCRIPTION_MAX = 20_000;

/**
 * Short of this, extraction has nothing to work with and the score would be built on
 * two lines of prose. Cheaper to say so than to spend a credit proving it.
 */
export const JOB_DESCRIPTION_MIN = 120;

export const jobDescriptionSchema = z.object({
  jobDescription: z
    .string()
    .trim()
    .min(JOB_DESCRIPTION_MIN, {
      message: `Paste a bit more of the posting — at least ${JOB_DESCRIPTION_MIN} characters, so the requirements are there to read.`,
    })
    .max(JOB_DESCRIPTION_MAX, {
      message: `That is longer than ${JOB_DESCRIPTION_MAX.toLocaleString()} characters. Paste the requirements and responsibilities, not the whole careers page.`,
    }),
});

export type JobDescriptionInput = z.infer<typeof jobDescriptionSchema>;

/** Severities of `JD_GAP_SEVERITY`, most serious first — the order the panel renders. */
export const GAP_SEVERITIES = ["blocking", "significant", "minor"] as const;

export type GapSeverity = (typeof GAP_SEVERITIES)[number];

export const GAP_SEVERITY_LABELS: Record<GapSeverity, string> = {
  blocking: "Blocking",
  significant: "Significant",
  minor: "Minor",
};

export const SENIORITY_LABELS: Record<JdSeniority, string> = {
  internship: "Internship",
  entry: "Entry level",
  mid: "Mid level",
  senior: "Senior",
  lead: "Lead",
  principal: "Principal",
  executive: "Executive",
  unspecified: "Not stated",
};

/** Where a matched keyword was found. Phrased as evidence, since that is what it is. */
export const ZONE_LABELS: Record<ResumeZone, string> = {
  experience: "in a role",
  projects: "in a project",
  summary: "in your summary",
  skills: "in your skills",
  education: "in your education",
  other: "elsewhere",
};

export interface BandCopy {
  readonly label: string;
  /** One line under the score. Says what to do next, not how to feel. */
  readonly summary: string;
}

export const BAND_COPY: Record<AtsBand, BandCopy> = {
  strong: {
    label: "Strong match",
    summary: "Close to the posting. Fix any required keyword below and apply.",
  },
  solid: {
    label: "Solid match",
    summary: "Worth applying. Covering the required gaps first moves this the furthest.",
  },
  partial: {
    label: "Partial match",
    summary: "Several requirements are missing. Add the ones you genuinely have.",
  },
  weak: {
    label: "Weak match",
    summary: "This posting asks for work your resume does not show yet.",
  },
};
