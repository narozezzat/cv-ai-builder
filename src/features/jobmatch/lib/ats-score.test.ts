/**
 * The number the user acts on.
 *
 * Two kinds of assertion here. Most pin a *policy* — required beats preferred, evidence
 * beats a skills list, under-level costs more than over-level — because those are product
 * decisions that should not change silently when someone tunes a constant.
 *
 * The last one is the plan's P3 gate: the same posting and the same resume must produce
 * the same score on every run. It holds because nothing in this path reads the clock, and
 * it is asserted rather than assumed because a score that moves between runs teaches the
 * user the score means nothing.
 */

import { describe, expect, it } from "vitest";

import type { JobMatchExtractOutput } from "@/services/ai";
import {
  createSection,
  createSectionItem,
  emptyResumeDocument,
  type ExperienceItem,
  type ResumeDocument,
  type SkillItem,
} from "@/types/resume";

import { ATS_WEIGHTS, scoreJobMatch, type AtsComponentId, type AtsScore } from "./ats-score";
import { buildResumeIndex } from "./resume-index";

const ASOF = "2026-07";

type Requirement = JobMatchExtractOutput["hardSkills"][number];

function required(keyword: string, aliases: string[] = []): Requirement {
  return { keyword, importance: "required", aliases };
}

function preferred(keyword: string, aliases: string[] = []): Requirement {
  return { keyword, importance: "preferred", aliases };
}

function posting(overrides: Partial<JobMatchExtractOutput> = {}): JobMatchExtractOutput {
  return {
    jobTitle: "Frontend Engineer",
    company: null,
    seniority: "unspecified",
    yearsExperience: null,
    educationRequirement: null,
    hardSkills: [],
    softSkills: [],
    responsibilities: [],
    qualifications: [],
    ...overrides,
  };
}

function experienceSection(items: Partial<ExperienceItem>[]) {
  const section = createSection("experience");

  return {
    ...section,
    items: items.map((item) => ({ ...createSectionItem("experience"), ...item })),
  };
}

function skillsSection(items: Partial<SkillItem>[]) {
  const section = createSection("skills");

  return {
    ...section,
    items: items.map((item) => ({ ...createSectionItem("skills"), ...item })),
  };
}

function documentWith(
  sections: ResumeDocument["sections"],
  basics: Partial<ResumeDocument["basics"]> = {},
): ResumeDocument {
  const document = emptyResumeDocument();

  return { ...document, basics: { ...document.basics, ...basics }, sections };
}

function score(job: JobMatchExtractOutput, document: ResumeDocument): AtsScore {
  return scoreJobMatch(job, buildResumeIndex(document, { asOf: ASOF }));
}

function component(result: AtsScore, id: AtsComponentId) {
  return result.components.find((entry) => entry.id === id);
}

/** A resume that demonstrates React inside a real job. */
const reactResume = documentWith([
  experienceSection([{ position: "Engineer", highlights: ["Built the React design system"] }]),
]);

describe("scoreJobMatch — totals", () => {
  it("scores a fully covered posting 100", () => {
    const result = score(posting({ hardSkills: [required("React")] }), reactResume);

    expect(result.total).toBe(100);
    expect(result.band).toBe("strong");
  });

  it("scores full when the posting states no requirements to fail", () => {
    // A vague posting must not rank below a detailed one for reasons about the posting.
    expect(score(posting(), reactResume).total).toBe(100);
  });

  it("gives an empty resume no keyword points", () => {
    const result = score(
      posting({ hardSkills: [required("Rust")], softSkills: [required("Mentoring")] }),
      emptyResumeDocument(),
    );

    expect(component(result, "hardSkills")?.score).toBe(0);
    expect(component(result, "softSkills")?.score).toBe(0);
    expect(component(result, "evidence")?.score).toBe(0);
    expect(result.band).toBe("weak");
  });

  it("returns an integer total inside 0–100 whatever the components do", () => {
    const result = score(
      posting({
        hardSkills: [required("React"), preferred("Vue"), preferred("Svelte")],
        softSkills: [preferred("Communication")],
        seniority: "principal",
        yearsExperience: 9,
      }),
      reactResume,
    );

    expect(Number.isInteger(result.total)).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });
});

describe("scoreJobMatch — keyword pools", () => {
  it("weights a required skill as three preferred ones", () => {
    const result = score(
      posting({ hardSkills: [required("Rust"), preferred("React")] }),
      reactResume,
    );

    // React met (weight 1) out of a weighted total of 4.
    expect(component(result, "hardSkills")?.score).toBe(17.5);
  });

  it("hands an absent pool's points to the other one", () => {
    const hardOnly = score(posting({ hardSkills: [required("React")] }), reactResume);

    expect(component(hardOnly, "hardSkills")?.max).toBe(
      ATS_WEIGHTS.hardSkills + ATS_WEIGHTS.softSkills,
    );

    const softOnly = score(
      posting({ softSkills: [required("Mentoring")] }),
      documentWith([experienceSection([{ highlights: ["Mentoring three engineers"] }])]),
    );

    expect(component(softOnly, "softSkills")?.max).toBe(
      ATS_WEIGHTS.hardSkills + ATS_WEIGHTS.softSkills,
    );
    // A component worth nothing is not rendered at all, rather than shown as 0 / 0.
    expect(component(softOnly, "hardSkills")).toBeUndefined();
  });

  it("splits the pool when the posting lists both kinds", () => {
    const result = score(
      posting({ hardSkills: [required("React")], softSkills: [required("Mentoring")] }),
      reactResume,
    );

    expect(component(result, "hardSkills")?.max).toBe(ATS_WEIGHTS.hardSkills);
    expect(component(result, "softSkills")?.max).toBe(ATS_WEIGHTS.softSkills);
    expect(result.total).toBe(85);
  });

  it("credits a requirement matched only through an alias", () => {
    const result = score(
      posting({ hardSkills: [required("Kubernetes", ["K8s"])] }),
      documentWith([experienceSection([{ highlights: ["Ran K8s clusters"] }])]),
    );

    expect(result.matched.map((verdict) => verdict.keyword)).toEqual(["Kubernetes"]);
    // The report names the posting's word, not the alias the resume happened to use.
    expect(result.missing).toEqual([]);
  });

  it("orders missing keywords the way they should be fixed", () => {
    const result = score(
      posting({
        hardSkills: [preferred("Terraform"), required("Rust")],
        softSkills: [required("Public speaking"), preferred("Negotiation")],
      }),
      emptyResumeDocument(),
    );

    expect(result.missing.map((verdict) => verdict.keyword)).toEqual([
      "Rust",
      "Public speaking",
      "Terraform",
      "Negotiation",
    ]);
  });
});

describe("scoreJobMatch — evidence", () => {
  it("scores a skill listed but never used below the same skill in a job", () => {
    const listed = score(
      posting({ hardSkills: [required("React")] }),
      documentWith([skillsSection([{ name: "React" }])]),
    );
    const used = score(posting({ hardSkills: [required("React")] }), reactResume);

    expect(component(listed, "hardSkills")?.score).toBe(component(used, "hardSkills")?.score);
    expect(component(listed, "evidence")?.score).toBe(0);
    expect(component(used, "evidence")?.score).toBe(ATS_WEIGHTS.evidence);
    expect(listed.total).toBeLessThan(used.total);
  });

  it("measures evidence against matched skills, not against the whole posting", () => {
    // One of two matched skills is evidenced; the unmatched third is already penalised
    // by the hard-skills component and must not be counted twice.
    const result = score(
      posting({ hardSkills: [required("React"), required("Docker"), required("Rust")] }),
      documentWith([
        experienceSection([{ highlights: ["Built the React design system"] }]),
        skillsSection([{ name: "Docker" }]),
      ]),
    );

    expect(component(result, "evidence")?.score).toBe(7.5);
  });
});

describe("scoreJobMatch — seniority", () => {
  it("penalises under-level harder than over-level", () => {
    const below = score(
      posting({ seniority: "senior" }),
      documentWith([], { headline: "Junior Engineer" }),
    );
    const above = score(
      posting({ seniority: "entry" }),
      documentWith([], { headline: "Senior Engineer" }),
    );

    expect(component(below, "seniority")?.score).toBe(3);
    expect(component(above, "seniority")?.score).toBe(8);
  });

  it("scores full when either side states no level", () => {
    const noHeadline = score(posting({ seniority: "senior" }), reactResume);
    const noAsk = score(posting(), documentWith([], { headline: "Junior Engineer" }));

    expect(component(noHeadline, "seniority")?.score).toBe(ATS_WEIGHTS.seniority);
    expect(noHeadline.resumeSeniority).toBeNull();
    expect(component(noAsk, "seniority")?.score).toBe(ATS_WEIGHTS.seniority);
  });

  it("reads the most senior word in the headline", () => {
    const result = score(posting(), documentWith([], { headline: "Senior Staff Engineer" }));

    expect(result.resumeSeniority).toBe("lead");
  });

  it("does not read a level out of a word that merely contains one", () => {
    const result = score(posting(), documentWith([], { headline: "Internal Tools Engineer" }));

    expect(result.resumeSeniority).toBeNull();
  });
});

describe("scoreJobMatch — years", () => {
  const twoYears = documentWith([
    experienceSection([{ startDate: "2024-01", endDate: "2025-12", current: false }]),
  ]);

  it("bands the shortfall rather than scaling it linearly", () => {
    expect(component(score(posting({ yearsExperience: 2 }), twoYears), "experienceYears")?.score) //
      .toBe(ATS_WEIGHTS.experienceYears);
    expect(component(score(posting({ yearsExperience: 4 }), twoYears), "experienceYears")?.score) //
      .toBe(3);
    expect(component(score(posting({ yearsExperience: 20 }), twoYears), "experienceYears")?.score) //
      .toBe(0);
  });

  it("scores full when the posting names no number", () => {
    const result = score(posting(), twoYears);

    expect(component(result, "experienceYears")?.score).toBe(ATS_WEIGHTS.experienceYears);
    expect(result.requiredYears).toBeNull();
    expect(result.experienceYears).toBe(2);
  });

  it("scores zero when a year count is asked for and no role is dated", () => {
    const result = score(
      posting({ yearsExperience: 3 }),
      documentWith([experienceSection([{ position: "Engineer" }])]),
    );

    expect(component(result, "experienceYears")?.score).toBe(0);
  });
});

describe("scoreJobMatch — determinism", () => {
  it("produces the same score on repeated runs over identical input", () => {
    const job = posting({
      hardSkills: [required("React"), preferred("GraphQL")],
      softSkills: [required("Mentoring")],
      seniority: "senior",
      yearsExperience: 5,
    });
    const document = documentWith(
      [
        experienceSection([
          {
            position: "Senior Engineer",
            highlights: ["Built the React design system", "Mentoring three engineers"],
            startDate: "2021-06",
            endDate: "",
            current: true,
          },
        ]),
        skillsSection([{ name: "GraphQL" }]),
      ],
      { headline: "Senior Engineer" },
    );

    const runs = Array.from({ length: 5 }, () => score(job, document));

    for (const run of runs) expect(run).toEqual(runs[0]);
    // Pinned, so a weight change is a deliberate edit to this line rather than a drift.
    // 55 hard + 15 soft + 7.5 evidence (GraphQL is only listed) + 10 level + 5 years.
    expect(runs[0].total).toBe(93);
  });
});
