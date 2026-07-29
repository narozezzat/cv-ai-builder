import { describe, expect, it } from "vitest";

import {
  createSection,
  createSectionItem,
  type ItemSectionKind,
  type ResumeSection,
  type ResumeSectionOf,
} from "@/types/resume";

import { partitionAsideSections, sectionWeight, splitBalancedSections } from "./section-columns";

/** An item section with `itemCount` blank items — enough to be non-empty and to carry weight. */
function itemSection<TKind extends ItemSectionKind>(
  kind: TKind,
  itemCount = 1,
): ResumeSectionOf<TKind> {
  return {
    ...createSection(kind),
    items: Array.from({ length: itemCount }, () => createSectionItem(kind)),
  } as ResumeSectionOf<TKind>;
}

function summarySection(content = "<p>Ten years shipping payment systems.</p>") {
  return { ...createSection("summary"), content };
}

function titles(sections: readonly ResumeSection[]): string[] {
  return sections.map((section) => section.title);
}

describe("partitionAsideSections", () => {
  it("sends the narrow-column kinds to the aside and everything else to main", () => {
    const split = partitionAsideSections([
      summarySection(),
      itemSection("experience", 2),
      itemSection("skills", 6),
      itemSection("education"),
      itemSection("languages", 2),
      itemSection("certifications"),
      itemSection("interests", 3),
    ]);

    expect(titles(split.main)).toEqual(["Summary", "Experience", "Education"]);
    expect(titles(split.aside)).toEqual(["Skills", "Languages", "Certifications", "Interests"]);
  });

  /**
   * Reordering in the editor writes the array, so a split that sorted would undo the drag
   * the user just performed. Both columns have to come out in document order.
   */
  it("preserves document order inside each column", () => {
    const split = partitionAsideSections([
      itemSection("interests"),
      itemSection("projects"),
      itemSection("skills"),
      summarySection(),
      itemSection("languages"),
      itemSection("experience"),
    ]);

    expect(titles(split.main)).toEqual(["Projects", "Summary", "Experience"]);
    expect(titles(split.aside)).toEqual(["Interests", "Skills", "Languages"]);
  });

  it("drops hidden and empty sections before splitting", () => {
    const split = partitionAsideSections([
      { ...itemSection("experience"), visible: false },
      itemSection("education", 0),
      { ...summarySection(""), title: "Summary" },
      itemSection("skills", 4),
      itemSection("projects"),
    ]);

    expect(titles(split.main)).toEqual(["Projects"]);
    expect(titles(split.aside)).toEqual(["Skills"]);
  });

  /**
   * The fallback is the whole reason this is a function and not an inline filter: a sidebar
   * template must not render a third of the page as an empty tinted stripe.
   */
  it("collapses to one column when nothing would land in the aside", () => {
    const split = partitionAsideSections([summarySection(), itemSection("experience", 3)]);

    expect(titles(split.main)).toEqual(["Summary", "Experience"]);
    expect(split.aside).toEqual([]);
  });

  it("collapses to one column when everything would land in the aside", () => {
    const split = partitionAsideSections([itemSection("skills", 8), itemSection("languages", 2)]);

    expect(titles(split.main)).toEqual(["Skills", "Languages"]);
    expect(split.aside).toEqual([]);
  });

  it("returns two empty columns for a document with nothing to show", () => {
    expect(partitionAsideSections([])).toEqual({ main: [], aside: [] });
    expect(partitionAsideSections([itemSection("skills", 0)])).toEqual({ main: [], aside: [] });
  });
});

describe("sectionWeight", () => {
  it("gives prose a flat weight rather than the score an item-less section would get", () => {
    expect(sectionWeight(summarySection())).toBe(4);
  });

  it("scales with item count", () => {
    expect(sectionWeight(itemSection("experience", 0))).toBe(1);
    expect(sectionWeight(itemSection("experience", 1))).toBe(3);
    expect(sectionWeight(itemSection("experience", 5))).toBe(11);
  });
});

describe("splitBalancedSections", () => {
  it("breaks once the left column passes half the total weight", () => {
    const split = splitBalancedSections([
      itemSection("experience", 1),
      itemSection("education", 1),
      itemSection("projects", 1),
      itemSection("skills", 1),
    ]);

    expect(titles(split.left)).toEqual(["Experience", "Education"]);
    expect(titles(split.right)).toEqual(["Projects", "Skills"]);
  });

  it("keeps document order within each column", () => {
    const split = splitBalancedSections([
      summarySection(),
      itemSection("experience", 3),
      itemSection("skills", 4),
      itemSection("education", 2),
      itemSection("languages", 2),
    ]);

    expect(titles(split.left)).toEqual(["Summary", "Experience", "Skills"]);
    expect(titles(split.right)).toEqual(["Education", "Languages"]);
  });

  /**
   * The edge case the greedy loop cannot see on its own: a light section followed by a
   * heavy one satisfies `filled < target` on both passes, so both would land left and the
   * right column would render empty next to them.
   */
  it("moves the last section over when the greedy pass fills only the left column", () => {
    const split = splitBalancedSections([itemSection("skills", 1), itemSection("experience", 10)]);

    expect(titles(split.left)).toEqual(["Skills"]);
    expect(titles(split.right)).toEqual(["Experience"]);
  });

  it("leaves a single section alone for the layout to collapse", () => {
    const split = splitBalancedSections([itemSection("experience", 4)]);

    expect(titles(split.left)).toEqual(["Experience"]);
    expect(split.right).toEqual([]);
  });

  it("returns two empty columns for a document with nothing to show", () => {
    expect(splitBalancedSections([])).toEqual({ left: [], right: [] });
    expect(splitBalancedSections([itemSection("awards", 0)])).toEqual({ left: [], right: [] });
  });

  /** A hidden section must not shift the break, which it would if it counted toward target. */
  it("ignores hidden sections when computing the target", () => {
    const hiddenHeavy = { ...itemSection("publications", 20), visible: false };
    const split = splitBalancedSections([
      itemSection("experience", 1),
      hiddenHeavy,
      itemSection("education", 1),
      itemSection("projects", 1),
      itemSection("skills", 1),
    ]);

    expect(titles(split.left)).toEqual(["Experience", "Education"]);
    expect(titles(split.right)).toEqual(["Projects", "Skills"]);
  });

  it("never loses or duplicates a visible section", () => {
    const sections = [
      summarySection(),
      itemSection("experience", 2),
      itemSection("skills", 5),
      itemSection("education"),
      itemSection("awards", 3),
      itemSection("interests", 4),
    ];

    const split = splitBalancedSections(sections);

    expect([...split.left, ...split.right].map((section) => section.id)).toEqual(
      sections.map((section) => section.id),
    );
  });
});
