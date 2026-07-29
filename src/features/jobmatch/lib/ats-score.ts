/**
 * The match score. A hundred points of arithmetic, no model involved.
 *
 * The model's only job in this flow is extraction and explanation — it never produces a
 * number. Everything below is a pure function of (extracted posting, resume document,
 * `asOf` date), which buys three things a generated score cannot have:
 *
 * - **Stability.** The same posting and the same resume produce the same score, forever.
 *   Re-running because the first number looked wrong is how a user learns the number
 *   means nothing.
 * - **Explainability.** Every point is attributable to a component with a sentence, and
 *   every missing keyword is a term that literally does not appear in the document. The
 *   report can therefore say *why*, and the advice is actionable.
 * - **Free.** Adjusting a bullet and re-scoring costs no credits, so the tighten-and-
 *   check loop the feature exists to support is not metered.
 *
 * The weights are constants under test rather than tuning knobs in a prompt. What they
 * encode:
 *
 * | Component  | Max | Why                                                            |
 * | ---------- | --- | -------------------------------------------------------------- |
 * | Hard skills| 55  | The bulk. A keyword filter rejects on these, and `required`     |
 * |            |     | requirements count triple a `preferred` one.                   |
 * | Soft skills| 15  | Real, but a posting's soft-skill list is mostly boilerplate.    |
 * | Evidence   | 15  | A hard skill named in a job or a project outranks the same word |
 * |            |     | sitting in a skills list — this is "weighted by section".       |
 * | Seniority  | 10  | Under-level is penalised harder than over-level: a stretch is a |
 * |            |     | maybe, a mismatch downward is usually a no.                     |
 * | Years      |  5  | Smallest weight on purpose. Stated year counts are soft filters |
 * |            |     | and our own total is inferred from dates the user may not have  |
 * |            |     | filled in.                                                     |
 *
 * "Nothing to fail" scores full, everywhere: a posting that lists no hard skills, states
 * no seniority, or names no year count cannot cost the candidate points for it. The
 * alternative — scoring an absent requirement as unmet — would rank a vague posting
 * below a detailed one for reasons that say nothing about the resume.
 */

import type { JobMatchExtractOutput } from "@/services/ai";

import { phrasesFor } from "./keywords";
import {
  EVIDENCE_ZONES,
  RESUME_ZONES,
  findZones,
  type ResumeIndex,
  type ResumeZone,
} from "./resume-index";

/** Derived from the prompt schema, so a schema change breaks this file at typecheck. */
type JobRequirement = JobMatchExtractOutput["hardSkills"][number];

export type JdImportance = JobRequirement["importance"];
export type JdSeniority = JobMatchExtractOutput["seniority"];

export const ATS_WEIGHTS = {
  hardSkills: 55,
  softSkills: 15,
  evidence: 15,
  seniority: 10,
  experienceYears: 5,
} as const;

/** A `required` requirement is worth three `preferred` ones within its pool. */
const IMPORTANCE_WEIGHT: Record<JdImportance, number> = { required: 3, preferred: 1 };

export const ATS_COMPONENTS = [
  "hardSkills",
  "softSkills",
  "evidence",
  "seniority",
  "experienceYears",
] as const;

export type AtsComponentId = (typeof ATS_COMPONENTS)[number];

export const ATS_BANDS = ["strong", "solid", "partial", "weak"] as const;

export type AtsBand = (typeof ATS_BANDS)[number];

export interface AtsComponent {
  readonly id: AtsComponentId;
  readonly label: string;
  readonly score: number;
  readonly max: number;
  /** One sentence saying what produced the score. Rendered as-is in the report. */
  readonly detail: string;
}

export interface KeywordVerdict {
  /** The posting's own wording, which is what the user should add. */
  readonly keyword: string;
  readonly importance: JdImportance;
  readonly pool: "hard" | "soft";
  /** Empty when missing; otherwise strongest evidence first. */
  readonly zones: readonly ResumeZone[];
}

export interface AtsScore {
  readonly total: number;
  readonly band: AtsBand;
  readonly components: readonly AtsComponent[];
  readonly matched: readonly KeywordVerdict[];
  /** Ordered required-before-preferred, hard-before-soft — the fix order. */
  readonly missing: readonly KeywordVerdict[];
  /** What the document's dates add up to, one decimal place. */
  readonly experienceYears: number;
  readonly requiredYears: number | null;
  readonly seniority: JdSeniority;
  /** What the headline claims, or `null` when it claims nothing. */
  readonly resumeSeniority: Exclude<JdSeniority, "unspecified"> | null;
}

/** Ordered, so "how far apart" is subtraction. `unspecified` is absence, not a level. */
const SENIORITY_RANK: Record<Exclude<JdSeniority, "unspecified">, number> = {
  internship: 0,
  entry: 1,
  mid: 2,
  senior: 3,
  lead: 4,
  principal: 5,
  executive: 6,
};

/**
 * Headline words we will read as a level claim, matched as whole tokens.
 *
 * Token matching is what keeps "internal tooling" from reading as an internship and
 * "leadership" from reading as a lead role — `tokenize` never matches inside a word.
 */
const HEADLINE_SENIORITY: readonly (readonly [string, Exclude<JdSeniority, "unspecified">])[] = [
  ["intern", "internship"],
  ["internship", "internship"],
  ["trainee", "entry"],
  ["junior", "entry"],
  ["jr", "entry"],
  ["graduate", "entry"],
  ["entry", "entry"],
  ["associate", "entry"],
  ["mid", "mid"],
  ["senior", "senior"],
  ["sr", "senior"],
  ["lead", "lead"],
  ["staff", "lead"],
  ["manager", "lead"],
  ["head", "lead"],
  ["principal", "principal"],
  ["architect", "principal"],
  ["director", "principal"],
  ["vp", "executive"],
  ["chief", "executive"],
  ["cto", "executive"],
  ["ceo", "executive"],
  ["founder", "executive"],
  ["executive", "executive"],
];

/**
 * The most senior level the headline claims.
 *
 * Highest wins because a title carrying two words is the senior of them: "Senior Staff
 * Engineer" is staff-level, and "Head of Engineering, Principal" is principal.
 */
function detectResumeSeniority(
  headline: readonly string[],
): Exclude<JdSeniority, "unspecified"> | null {
  const tokens = new Set(headline);
  let best: Exclude<JdSeniority, "unspecified"> | null = null;

  for (const [token, level] of HEADLINE_SENIORITY) {
    if (!tokens.has(token)) continue;
    if (best === null || SENIORITY_RANK[level] > SENIORITY_RANK[best]) best = level;
  }

  return best;
}

/** Scores are compared in tests and rendered as text; one decimal keeps both stable. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function verdictFor(
  requirement: JobRequirement,
  pool: "hard" | "soft",
  index: ResumeIndex,
): KeywordVerdict {
  // Aliases are alternatives, so where the term appears is the union of their zones,
  // re-sorted into canonical order rather than left in discovery order.
  const found = new Set<ResumeZone>();

  for (const phrase of phrasesFor(requirement.keyword, requirement.aliases)) {
    for (const zone of findZones(index, phrase)) found.add(zone);
  }

  return {
    keyword: requirement.keyword,
    importance: requirement.importance,
    pool,
    zones: RESUME_ZONES.filter((zone) => found.has(zone)),
  };
}

function weightedCoverage(verdicts: readonly KeywordVerdict[]): number {
  let total = 0;
  let met = 0;

  for (const verdict of verdicts) {
    const weight = IMPORTANCE_WEIGHT[verdict.importance];

    total += weight;
    if (verdict.zones.length > 0) met += weight;
  }

  return total === 0 ? 1 : met / total;
}

function keywordDetail(verdicts: readonly KeywordVerdict[], noun: string): string {
  const met = verdicts.filter((verdict) => verdict.zones.length > 0).length;

  if (verdicts.length === 0) return `The posting lists no ${noun}, so this scores full.`;

  const missingRequired = verdicts.filter(
    (verdict) => verdict.zones.length === 0 && verdict.importance === "required",
  ).length;

  const suffix =
    missingRequired > 0
      ? ` ${missingRequired} of the missing ${missingRequired === 1 ? "one is" : "ones are"} required.`
      : "";

  return `${met} of ${verdicts.length} ${noun} appear on your resume.${suffix}`;
}

/**
 * Seniority fit. Either side saying nothing scores full — a posting that omits its level
 * has not set a bar to miss.
 *
 * Asymmetric by design. One level above the ask is barely a penalty (people apply down),
 * while one level below is the gap a recruiter screens on.
 */
function seniorityScore(
  jd: JdSeniority,
  resume: Exclude<JdSeniority, "unspecified"> | null,
): { score: number; detail: string } {
  const max = ATS_WEIGHTS.seniority;

  if (jd === "unspecified") {
    return { score: max, detail: "The posting does not state a level, so this scores full." };
  }

  if (resume === null) {
    return {
      score: max,
      detail: `The posting targets ${jd} level. Your headline states no level, so this is not scored — naming it makes the match legible to a screener.`,
    };
  }

  const distance = SENIORITY_RANK[resume] - SENIORITY_RANK[jd];

  if (distance === 0) {
    return { score: max, detail: `Your headline reads ${resume}, matching the posting's level.` };
  }

  const above = [max, max, max * 0.8, max * 0.6];
  const below = [max, max * 0.6, max * 0.3, 0];
  const steps = Math.min(Math.abs(distance), 3);
  const score = distance > 0 ? above[steps] : below[steps];

  const detail =
    distance > 0
      ? `Your headline reads ${resume}, above the posting's ${jd} level.`
      : `Your headline reads ${resume}, below the posting's ${jd} level.`;

  return { score, detail };
}

/**
 * Years of experience against a stated requirement.
 *
 * Banded rather than linear: the difference between four and five years against a
 * five-year ask is noise, while the difference between one and five is the whole
 * decision. Only whole thresholds change the score, so nudging a start date by a month
 * does not move the number.
 */
function yearsScore(required: number | null, actual: number): { score: number; detail: string } {
  const max = ATS_WEIGHTS.experienceYears;

  if (required === null) {
    return { score: max, detail: "The posting states no year count, so this scores full." };
  }

  if (required === 0) {
    return { score: max, detail: "The posting asks for no prior experience." };
  }

  if (actual === 0) {
    return {
      score: 0,
      detail: `The posting asks for ${required}+ years. Your experience section has no dated roles to count.`,
    };
  }

  const ratio = actual / required;
  const score =
    ratio >= 1
      ? max
      : ratio >= 0.75
        ? max * 0.8
        : ratio >= 0.5
          ? max * 0.6
          : ratio >= 0.25
            ? max * 0.2
            : 0;

  return {
    score,
    detail: `The posting asks for ${required}+ years; your dated roles add up to ${actual}.`,
  };
}

function evidenceScore(
  hard: readonly KeywordVerdict[],
  max: number,
): { score: number; detail: string } {
  if (hard.length === 0) {
    return { score: max, detail: "The posting lists no hard skills to evidence." };
  }

  const matched = hard.filter((verdict) => verdict.zones.length > 0);

  if (matched.length === 0) {
    return {
      score: 0,
      detail: "None of the posting's hard skills appear anywhere on your resume.",
    };
  }

  const evidenced = matched.filter((verdict) =>
    verdict.zones.some((zone) => EVIDENCE_ZONES.includes(zone)),
  );

  return {
    score: (max * evidenced.length) / matched.length,
    detail: `${evidenced.length} of your ${matched.length} matching hard skills appear inside a job or project, not only in a skills list.`,
  };
}

function bandFor(total: number): AtsBand {
  if (total >= 80) return "strong";
  if (total >= 60) return "solid";
  if (total >= 40) return "partial";

  return "weak";
}

/** Required before preferred, hard before soft, source order within a group. */
function byFixOrder(left: KeywordVerdict, right: KeywordVerdict): number {
  if (left.importance !== right.importance) return left.importance === "required" ? -1 : 1;
  if (left.pool !== right.pool) return left.pool === "hard" ? -1 : 1;

  return 0;
}

export function scoreJobMatch(posting: JobMatchExtractOutput, index: ResumeIndex): AtsScore {
  const hard = posting.hardSkills.map((requirement) => verdictFor(requirement, "hard", index));
  const soft = posting.softSkills.map((requirement) => verdictFor(requirement, "soft", index));

  // An absent pool hands its points to the other one, so a posting that lists only hard
  // skills is still scored out of the same seventy.
  const pool = ATS_WEIGHTS.hardSkills + ATS_WEIGHTS.softSkills;
  const hardMax = soft.length === 0 ? pool : hard.length === 0 ? 0 : ATS_WEIGHTS.hardSkills;
  const softMax = pool - hardMax;

  const evidence = evidenceScore(hard, ATS_WEIGHTS.evidence);
  const resumeSeniority = detectResumeSeniority(index.headline);
  const seniority = seniorityScore(posting.seniority, resumeSeniority);
  const experienceYears = round1(index.experienceMonths / 12);
  const years = yearsScore(posting.yearsExperience, experienceYears);

  const components: AtsComponent[] = [];

  if (hardMax > 0) {
    components.push({
      id: "hardSkills",
      label: "Hard skills",
      score: round1(hardMax * weightedCoverage(hard)),
      max: hardMax,
      detail: keywordDetail(hard, "hard skills"),
    });
  }

  if (softMax > 0) {
    components.push({
      id: "softSkills",
      label: "Soft skills",
      score: round1(softMax * weightedCoverage(soft)),
      max: softMax,
      detail: keywordDetail(soft, "soft skills"),
    });
  }

  components.push(
    {
      id: "evidence",
      label: "Evidence in your history",
      score: round1(evidence.score),
      max: ATS_WEIGHTS.evidence,
      detail: evidence.detail,
    },
    {
      id: "seniority",
      label: "Seniority fit",
      score: round1(seniority.score),
      max: ATS_WEIGHTS.seniority,
      detail: seniority.detail,
    },
    {
      id: "experienceYears",
      label: "Years of experience",
      score: round1(years.score),
      max: ATS_WEIGHTS.experienceYears,
      detail: years.detail,
    },
  );

  const all = [...hard, ...soft];
  const raw = components.reduce((sum, component) => sum + component.score, 0);
  // Banded off the displayed number, so a report never reads "80" next to "solid".
  const total = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    total,
    band: bandFor(total),
    components,
    matched: all.filter((verdict) => verdict.zones.length > 0),
    missing: all.filter((verdict) => verdict.zones.length === 0).sort(byFixOrder),
    experienceYears,
    requiredYears: posting.yearsExperience,
    seniority: posting.seniority,
    resumeSeniority,
  };
}
