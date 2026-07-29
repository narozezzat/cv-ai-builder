/**
 * How a multi-column layout decides what goes where.
 *
 * Pure functions, deliberately: a column split is the one thing in the template system a
 * user can notice being wrong, and it has to come out the same in the live preview, in the
 * print route, and on the share page. Keeping it out of the layout components means it can
 * be tested without rendering, and means five layouts share one set of rules instead of
 * arriving at five slightly different ones.
 *
 * Both functions preserve document order within a column. Reordering sections in the
 * editor writes the array, so a split that sorted would silently undo the drag the user
 * just performed — the columns may interleave, but neither column ever reorders.
 */

import type { ResumeSection } from "@/types/resume";

import { isSectionRendered } from "../components/resume-sections";

/**
 * Sections that read well in a narrow column: short, list-shaped, no prose.
 *
 * By kind rather than by measured height, because the aside is a design decision the
 * template makes, not a reaction to content — a resume with three skills and one with
 * thirty should put both in the same place. Experience, education, and projects are never
 * here: they carry bullets and dates that need the wider measure.
 */
const ASIDE_KINDS: ReadonlySet<ResumeSection["kind"]> = new Set([
  "skills",
  "languages",
  "certifications",
  "interests",
]);

export interface SectionSplit {
  main: ResumeSection[];
  aside: ResumeSection[];
}

/**
 * Splits visible sections into the wide column and the narrow one.
 *
 * Falls back to a single column — everything in `main`, `aside` empty — whenever the
 * split would leave a column blank. A sidebar template opened on a resume that is only
 * experience must not render a third of the page as an empty tinted stripe, and one that
 * is only skills must not render its whole content in the narrow column.
 */
export function partitionAsideSections(sections: readonly ResumeSection[]): SectionSplit {
  const visible = sections.filter(isSectionRendered);
  const aside = visible.filter((section) => ASIDE_KINDS.has(section.kind));
  const main = visible.filter((section) => !ASIDE_KINDS.has(section.kind));

  if (aside.length === 0 || main.length === 0) {
    return { main: visible, aside: [] };
  }

  return { main, aside };
}

/**
 * Rough vertical cost of a section, used only to decide where the column break falls.
 *
 * Item count dominates because an item is several lines; the heading itself is worth about
 * one. A summary is prose with no items, so it gets a flat weight rather than the `1` an
 * item-less section would otherwise score.
 */
export function sectionWeight(section: ResumeSection): number {
  if (section.kind === "summary") {
    return 4;
  }

  return 1 + section.items.length * 2;
}

/**
 * Splits visible sections into two roughly equal columns, in order.
 *
 * Greedy rather than optimal: sections fill the first column until it passes half the
 * total weight, then the rest go to the second. An optimal partition would be free to
 * reorder, which is exactly what it must not do — a reader scans top-left to bottom-left,
 * then top-right, and that only tells the truth if each column is in document order.
 *
 * With a single section there is nothing to balance, so it stays in the left column and
 * the right is left empty for the layout to collapse.
 */
export function splitBalancedSections(sections: readonly ResumeSection[]): {
  left: ResumeSection[];
  right: ResumeSection[];
} {
  const visible = sections.filter(isSectionRendered);

  if (visible.length < 2) {
    return { left: visible, right: [] };
  }

  const target = visible.reduce((sum, section) => sum + sectionWeight(section), 0) / 2;

  const left: ResumeSection[] = [];
  const right: ResumeSection[] = [];
  let filled = 0;

  for (const section of visible) {
    if (filled < target) {
      left.push(section);
      filled += sectionWeight(section);
    } else {
      right.push(section);
    }
  }

  // A trailing section heavy enough to be reached while the left column is still under
  // target lands there too, and `[summary, experience]` would come out as one column with
  // an empty neighbour. Move the last one over.
  const overflow = right.length === 0 ? left.pop() : undefined;

  if (overflow) {
    right.push(overflow);
  }

  return { left, right };
}
