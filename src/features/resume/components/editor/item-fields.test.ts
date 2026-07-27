import { describe, expect, it } from "vitest";

import {
  createSection,
  createSectionItem,
  type EducationItem,
  type ExperienceItem,
  type ResumeSectionOf,
  type SkillItem,
} from "@/types/resume";

import { summarizeItem } from "./item-fields";

/**
 * The collapsed row is the only view of an item most of the time — a ten-job resume
 * is ten collapsed rows. These assertions pin the two things that go wrong: a row
 * that reads "— · —" because it joined empty fields, and a row that says nothing
 * useful because the kind's identifying field was not the one it looked at.
 */

function experienceSection(item: Partial<ExperienceItem>): {
  section: ResumeSectionOf<"experience">;
  item: ExperienceItem;
} {
  const section = createSection("experience");
  const filled: ExperienceItem = { ...createSectionItem("experience"), ...item };

  section.items.push(filled);

  return { section, item: filled };
}

describe("summarizeItem", () => {
  it("names a job by its title and company", () => {
    const { section, item } = experienceSection({ position: "Staff Engineer", company: "Stripe" });

    expect(summarizeItem(section, item)).toMatchObject({ title: "Staff Engineer · Stripe" });
  });

  it("leaves the title empty when a job has neither field, so the caller can label it", () => {
    const { section, item } = experienceSection({});

    // Empty rather than a placeholder: `RepeatableSection` renders "Untitled job",
    // and a placeholder invented here would show up in drag announcements too.
    expect(summarizeItem(section, item).title).toBe("");
  });

  it("prints Present for a current role instead of an empty end date", () => {
    const { section, item } = experienceSection({
      position: "Engineer",
      startDate: "2021-03",
      current: true,
      endDate: "",
    });

    expect(summarizeItem(section, item).subtitle).toContain("2021-03 – Present");
  });

  it("marks an unknown end date rather than printing a dangling dash", () => {
    const { section, item } = experienceSection({ startDate: "2019", current: false, endDate: "" });

    expect(summarizeItem(section, item).subtitle).toContain("2019 – ?");
  });

  it("omits the date range entirely when there is no start date", () => {
    const { section, item } = experienceSection({ company: "Stripe", location: "Berlin" });

    expect(summarizeItem(section, item).subtitle).toBe("Berlin");
  });

  it("falls back to the institution when a qualification has no degree", () => {
    const section = createSection("education");
    const item: EducationItem = {
      ...createSectionItem("education"),
      institution: "TU Munich",
    };

    section.items.push(item);

    expect(summarizeItem(section, item).title).toBe("TU Munich");
  });

  it("does not repeat the institution in both lines", () => {
    const section = createSection("education");
    const item: EducationItem = {
      ...createSectionItem("education"),
      degree: "BSc",
      area: "Computer Science",
      institution: "TU Munich",
    };

    section.items.push(item);

    const summary = summarizeItem(section, item);

    expect(summary.title).toBe("BSc · Computer Science");
    expect(summary.subtitle).toBe("TU Munich");
  });

  it("hides an unrated skill's level instead of showing zero", () => {
    const section = createSection("skills");
    const item: SkillItem = {
      ...createSectionItem("skills"),
      name: "TypeScript",
      category: "Languages",
      level: 0,
    };

    section.items.push(item);

    expect(summarizeItem(section, item)).toMatchObject({
      title: "TypeScript",
      subtitle: "Languages",
    });
  });

  it("shows a rated skill's level in words", () => {
    const section = createSection("skills");
    const item: SkillItem = { ...createSectionItem("skills"), name: "Go", category: "", level: 4 };

    section.items.push(item);

    expect(summarizeItem(section, item).subtitle).toBe("Advanced");
  });
});
