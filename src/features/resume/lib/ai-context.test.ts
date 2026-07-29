import { describe, expect, it } from "vitest";

import { createSection, createSectionItem, emptyResumeDocument } from "@/types/resume";
import type { ExperienceItem, ResumeDocument, SkillItem } from "@/types/resume";

import {
  buildAiContext,
  buildAiExperience,
  buildAiRole,
  collectExistingSkills,
  formatPeriod,
} from "./ai-context";

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

function documentWith(sections: ResumeDocument["sections"]): ResumeDocument {
  return { ...emptyResumeDocument(), sections };
}

describe("buildAiContext", () => {
  it("takes the target role from the headline", () => {
    const document = emptyResumeDocument();

    document.basics.headline = "  Senior Platform Engineer  ";

    expect(buildAiContext(document).targetRole).toBe("Senior Platform Engineer");
  });

  it("reads seniority only from what the headline says", () => {
    const document = emptyResumeDocument();

    document.basics.headline = "Principal Designer";

    expect(buildAiContext(document).seniority).toBe("principal");

    document.basics.headline = "Designer";

    expect(buildAiContext(document).seniority).toBeUndefined();
  });

  it("never guesses an industry", () => {
    const document = emptyResumeDocument();

    document.basics.headline = "Fintech Product Manager";

    expect(buildAiContext(document).industry).toBeUndefined();
  });

  it("omits an empty headline rather than sending a blank string", () => {
    expect(buildAiContext(emptyResumeDocument()).targetRole).toBeUndefined();
  });
});

describe("collectExistingSkills", () => {
  it("flattens names and keywords, deduplicating case-insensitively", () => {
    const document = documentWith([
      skillsSection([
        { name: "Cloud", keywords: ["AWS", "Terraform"] },
        { name: "aws", keywords: ["  Docker  ", ""] },
      ]),
    ]);

    expect(collectExistingSkills(document)).toEqual(["Cloud", "AWS", "Terraform", "Docker"]);
  });

  it("ignores a hidden skills section", () => {
    const document = documentWith([skillsSection([{ name: "Rust" }], false)]);

    expect(collectExistingSkills(document)).toEqual([]);
  });

  it("caps the list at the prompt layer's limit", () => {
    const keywords = Array.from({ length: 60 }, (_, index) => `skill-${index}`);
    const document = documentWith([skillsSection([{ name: "Tools", keywords }])]);

    expect(collectExistingSkills(document)).toHaveLength(40);
  });

  it("truncates a skill name longer than a keyword may be", () => {
    const document = documentWith([skillsSection([{ name: "x".repeat(120) }])]);

    expect(collectExistingSkills(document)[0]).toHaveLength(80);
  });
});

describe("formatPeriod", () => {
  it("renders an open-ended role as Present", () => {
    expect(formatPeriod({ startDate: "2021-03", endDate: "", current: true })).toBe(
      "2021-03 – Present",
    );
  });

  it("ignores endDate when current is set", () => {
    expect(formatPeriod({ startDate: "2021", endDate: "2022", current: true })).toBe(
      "2021 – Present",
    );
  });

  it("falls back to whichever date exists", () => {
    expect(formatPeriod({ startDate: "", endDate: "2019", current: false })).toBe("2019");
    expect(formatPeriod({ startDate: "", endDate: "", current: false })).toBeUndefined();
  });
});

describe("buildAiExperience", () => {
  it("drops roles with no position, because the schema requires one", () => {
    const document = documentWith([
      experienceSection([{ position: "", company: "Acme" }, { position: "Engineer" }]),
    ]);

    expect(buildAiExperience(document).map((entry) => entry.position)).toEqual(["Engineer"]);
  });

  it("slices highlights to the entry limit", () => {
    const highlights = Array.from({ length: 30 }, (_, index) => `did thing ${index}`);
    const document = documentWith([experienceSection([{ position: "Engineer", highlights }])]);

    expect(buildAiExperience(document)[0]?.highlights).toHaveLength(20);
  });

  it("drops blank highlights", () => {
    const document = documentWith([
      experienceSection([{ position: "Engineer", highlights: ["  ", "Shipped it"] }]),
    ]);

    expect(buildAiExperience(document)[0]?.highlights).toEqual(["Shipped it"]);
  });

  it("caps the history at twelve roles across sections", () => {
    const items = Array.from({ length: 8 }, (_, index) => ({ position: `Role ${index}` }));
    const document = documentWith([experienceSection(items), experienceSection(items)]);

    expect(buildAiExperience(document)).toHaveLength(12);
  });

  it("skips a hidden experience section", () => {
    const document = documentWith([experienceSection([{ position: "Engineer" }], false)]);

    expect(buildAiExperience(document)).toEqual([]);
  });
});

describe("buildAiRole", () => {
  it("flattens the rich-text summary to prose", () => {
    const item: ExperienceItem = {
      ...createSectionItem("experience"),
      position: "Engineer",
      summary: "<p>Owned <strong>billing</strong></p>",
    };

    expect(buildAiRole(item).summary).toBe("Owned billing");
  });

  it("keeps a titleless role, unlike the history builder", () => {
    const item: ExperienceItem = { ...createSectionItem("experience"), position: "" };

    expect(buildAiRole(item).position).toBe("");
  });

  it("keeps all thirty highlights the document allows", () => {
    const highlights = Array.from({ length: 30 }, (_, index) => `did thing ${index}`);
    const item: ExperienceItem = {
      ...createSectionItem("experience"),
      position: "Engineer",
      highlights,
    };

    expect(buildAiRole(item).highlights).toHaveLength(30);
  });
});
