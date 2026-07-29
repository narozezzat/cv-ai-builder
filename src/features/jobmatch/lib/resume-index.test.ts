/**
 * What counts as "on the resume", and where.
 *
 * The zone assertions are the ones with product consequences: `findZones` is what lets the
 * scorer separate a skill someone listed from a skill someone did, so a term landing in
 * the wrong zone quietly changes the evidence component for every user.
 *
 * The month arithmetic gets the same attention because it feeds the years component and
 * because a resume's dates overlap constantly — two concurrent roles are not double the
 * experience.
 */

import { describe, expect, it } from "vitest";

import {
  createSection,
  createSectionItem,
  emptyResumeDocument,
  type ExperienceItem,
  type ProjectItem,
  type ReferenceItem,
  type ResumeDocument,
  type SkillItem,
} from "@/types/resume";

import { tokenize } from "./keywords";
import { buildResumeIndex, findZones, type ResumeZone } from "./resume-index";

const ASOF = "2026-07";

function experienceSection(items: Partial<ExperienceItem>[], visible = true) {
  const section = createSection("experience");

  return {
    ...section,
    visible,
    items: items.map((item) => ({ ...createSectionItem("experience"), ...item })),
  };
}

function skillsSection(items: Partial<SkillItem>[], visible = true) {
  const section = createSection("skills");

  return {
    ...section,
    visible,
    items: items.map((item) => ({ ...createSectionItem("skills"), ...item })),
  };
}

function projectsSection(items: Partial<ProjectItem>[]) {
  const section = createSection("projects");

  return {
    ...section,
    items: items.map((item) => ({ ...createSectionItem("projects"), ...item })),
  };
}

function referencesSection(items: Partial<ReferenceItem>[]) {
  const section = createSection("references");

  return {
    ...section,
    items: items.map((item) => ({ ...createSectionItem("references"), ...item })),
  };
}

function documentWith(
  sections: ResumeDocument["sections"],
  basics: Partial<ResumeDocument["basics"]> = {},
): ResumeDocument {
  const document = emptyResumeDocument();

  return { ...document, basics: { ...document.basics, ...basics }, sections };
}

function zonesFor(document: ResumeDocument, keyword: string): ResumeZone[] {
  return findZones(buildResumeIndex(document, { asOf: ASOF }), tokenize(keyword));
}

function monthsFor(items: Partial<ExperienceItem>[]): number {
  return buildResumeIndex(documentWith([experienceSection(items)]), { asOf: ASOF })
    .experienceMonths;
}

describe("buildResumeIndex — zones", () => {
  it("separates a skill someone listed from a skill someone used", () => {
    const document = documentWith([
      experienceSection([{ position: "Engineer", highlights: ["Shipped a React app"] }]),
      skillsSection([{ name: "TypeScript" }]),
    ]);

    expect(zonesFor(document, "React")).toEqual(["experience"]);
    expect(zonesFor(document, "TypeScript")).toEqual(["skills"]);
  });

  it("reports every zone a term appears in, strongest first", () => {
    const document = documentWith([
      experienceSection([{ position: "React Engineer" }]),
      projectsSection([{ name: "React playground" }]),
      skillsSection([{ name: "React" }]),
    ]);

    expect(zonesFor(document, "React")).toEqual(["experience", "projects", "skills"]);
  });

  it("indexes the headline even with no sections at all", () => {
    const document = documentWith([], { headline: "Senior Platform Engineer" });

    expect(zonesFor(document, "Platform")).toEqual(["summary"]);
    expect(buildResumeIndex(document, { asOf: ASOF }).headline).toEqual([
      "senior",
      "platform",
      "engineer",
    ]);
  });

  it("reads rich text as prose, so markup is never a keyword", () => {
    const summary = createSection("summary");
    const document = documentWith([
      { ...summary, content: "<p>Led <strong>Kubernetes</strong> migrations</p>" },
    ]);

    expect(zonesFor(document, "Kubernetes")).toEqual(["summary"]);
    expect(zonesFor(document, "strong")).toEqual([]);
  });

  it("files languages and interests under skills, since both are claims", () => {
    const languages = createSection("languages");
    const document = documentWith([
      {
        ...languages,
        items: [{ ...createSectionItem("languages"), name: "Arabic" }],
      },
    ]);

    expect(zonesFor(document, "Arabic")).toEqual(["skills"]);
  });

  it("ignores a hidden section, because the employer never sees it", () => {
    const document = documentWith([
      experienceSection([{ position: "Engineer", technologies: ["Terraform"] }], false),
      skillsSection([{ name: "Docker" }], false),
    ]);

    expect(zonesFor(document, "Terraform")).toEqual([]);
    expect(zonesFor(document, "Docker")).toEqual([]);
  });

  it("ignores the references section — a referee's title is not the candidate's", () => {
    const document = documentWith([
      referencesSection([{ name: "Dana Reed", relationship: "Principal Architect" }]),
    ]);

    expect(zonesFor(document, "Architect")).toEqual([]);
  });

  it("keeps fields in separate runs, so adjacent fields cannot form a phrase", () => {
    const document = documentWith([
      experienceSection([
        { position: "Engineer", highlights: ["Shipped React", "Native modules"] },
      ]),
    ]);

    expect(zonesFor(document, "React Native")).toEqual([]);
  });
});

describe("buildResumeIndex — experience months", () => {
  it("counts a closed range inclusively", () => {
    expect(monthsFor([{ startDate: "2020-01", endDate: "2020-12", current: false }])).toBe(12);
  });

  it("counts a current role up to asOf, never past it", () => {
    expect(monthsFor([{ startDate: "2026-01", endDate: "", current: true }])).toBe(7);
  });

  it("merges overlapping roles instead of adding them", () => {
    const months = monthsFor([
      { startDate: "2020-01", endDate: "2021-12", current: false },
      { startDate: "2021-01", endDate: "2022-12", current: false },
    ]);

    expect(months).toBe(36);
  });

  it("closes a one-month gap between roles rather than penalising it", () => {
    const months = monthsFor([
      { startDate: "2020-01", endDate: "2020-06", current: false },
      { startDate: "2020-07", endDate: "2020-12", current: false },
    ]);

    expect(months).toBe(12);
  });

  it("keeps a real gap out of the total", () => {
    const months = monthsFor([
      { startDate: "2020-01", endDate: "2020-06", current: false },
      { startDate: "2021-01", endDate: "2021-06", current: false },
    ]);

    expect(months).toBe(12);
  });

  it("treats an undated or unfinished row as one month, not as running to today", () => {
    expect(monthsFor([{ startDate: "2019-01", endDate: "", current: false }])).toBe(1);
    expect(monthsFor([{ startDate: "", endDate: "2024-01", current: false }])).toBe(0);
  });

  it("reads a bare year as starting in January", () => {
    expect(monthsFor([{ startDate: "2023", endDate: "2023", current: false }])).toBe(1);
    expect(monthsFor([{ startDate: "2022", endDate: "2023-12", current: false }])).toBe(24);
  });

  it("survives a reversed range without going negative", () => {
    expect(monthsFor([{ startDate: "2022-12", endDate: "2022-01", current: false }])).toBe(12);
  });

  it("does not count dates from a hidden section", () => {
    const document = documentWith([
      experienceSection([{ startDate: "2010-01", endDate: "2020-01", current: false }], false),
    ]);

    expect(buildResumeIndex(document, { asOf: ASOF }).experienceMonths).toBe(0);
  });
});

describe("buildResumeIndex — determinism", () => {
  it("returns an identical index for identical input, since nothing reads the clock", () => {
    const document = documentWith(
      [
        experienceSection([
          { position: "Staff Engineer", startDate: "2019-04", endDate: "", current: true },
        ]),
        skillsSection([{ name: "Go" }]),
      ],
      { headline: "Staff Engineer" },
    );

    const first = buildResumeIndex(document, { asOf: ASOF });
    const second = buildResumeIndex(document, { asOf: ASOF });

    expect(second).toEqual(first);
  });
});
