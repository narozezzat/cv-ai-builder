/**
 * The resume document, flattened into something a matcher can read.
 *
 * Two products come out of one walk of the document:
 *
 * 1. **Token runs, grouped by zone.** One run per *field*, never per section, because a
 *    phrase may only match inside a single field — see `tokenize`. The zone is what
 *    later lets the scorer tell "React appears in a skills list" from "React appears in
 *    a job someone actually did", which is the difference between a keyword and
 *    evidence.
 * 2. **Merged months of experience**, so two overlapping roles are not four years.
 *
 * Deliberately excluded:
 *
 * - **Hidden sections.** A section toggled off is not on the resume being matched, so
 *   crediting its keywords would score a document the employer will never see.
 * - **The references section.** It is third-party personal data, and a referee's job
 *   title is not the candidate's experience.
 *
 * Nothing here reads the clock: `asOf` is a parameter, so a document with a current
 * role scores identically on every run — the determinism the plan's P3 gate asserts.
 */

import type { ResumeDocument } from "@/types/resume";
import { richTextToPlainText } from "@/utils/rich-text";

import { includesPhrase, tokenize } from "./keywords";

/**
 * Where on the resume a term was found, ordered strongest evidence first.
 *
 * `skills` is last among the credited zones on purpose: a skills list is a claim, while
 * `experience` and `projects` are a claim with a story attached.
 */
export const RESUME_ZONES = [
  "experience",
  "projects",
  "summary",
  "skills",
  "education",
  "other",
] as const;

export type ResumeZone = (typeof RESUME_ZONES)[number];

/** The zones that count as demonstrated rather than asserted. */
export const EVIDENCE_ZONES: readonly ResumeZone[] = ["experience", "projects"];

export interface ResumeIndex {
  /** One token run per source field, keyed by zone. */
  readonly zones: Readonly<Record<ResumeZone, readonly (readonly string[])[]>>;
  /** Dated, visible experience with overlaps merged. */
  readonly experienceMonths: number;
  /** Every headline token, for seniority detection. */
  readonly headline: readonly string[];
}

interface DateRange {
  readonly start: number;
  readonly end: number;
}

/** `YYYY`, `YYYY-MM`, and `YYYY-MM-DD` are all the editor's date fields can hold. */
const DATE_PATTERN = /^(\d{4})(?:-(\d{1,2}))?/;

/**
 * A month index, so range arithmetic is integer subtraction rather than date math.
 *
 * A bare year counts from January, which is what a user who typed only a year means.
 */
function toMonthIndex(value: string): number | null {
  const match = DATE_PATTERN.exec(value.trim());

  if (!match) return null;

  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : 1;

  if (month < 1 || month > 12) return null;

  return year * 12 + (month - 1);
}

/**
 * One role's span in months, or `null` if it has no usable start date.
 *
 * An open-ended role that is not flagged `current` counts as a single month rather than
 * running to today: "started 2019, no end date, not current" is an unfinished row in an
 * editor, and reading it as six years of experience would inflate the score for someone
 * who simply had not finished typing.
 */
function toRange(
  item: { startDate: string; endDate: string; current: boolean },
  asOfMonth: number,
): DateRange | null {
  const start = toMonthIndex(item.startDate);

  if (start === null) return null;

  const end = item.current ? asOfMonth : (toMonthIndex(item.endDate) ?? start);

  return end < start ? { start: end, end: start } : { start, end };
}

/** Inclusive months across merged ranges, so a Jan–Jan role is one month, not zero. */
function mergedMonths(ranges: readonly DateRange[]): number {
  const sorted = [...ranges].sort((left, right) => left.start - right.start);
  let months = 0;
  let open: DateRange | null = null;

  for (const range of sorted) {
    if (open && range.start <= open.end + 1) {
      open = { start: open.start, end: Math.max(open.end, range.end) };
      continue;
    }

    if (open) months += open.end - open.start + 1;
    open = range;
  }

  if (open) months += open.end - open.start + 1;

  return months;
}

/** Accumulates one token run per non-empty field. */
class ZoneCollector {
  private readonly runs: Record<ResumeZone, string[][]> = {
    experience: [],
    projects: [],
    summary: [],
    skills: [],
    education: [],
    other: [],
  };

  add(zone: ResumeZone, ...values: readonly (string | undefined)[]): void {
    for (const value of values) {
      if (!value) continue;

      const tokens = tokenize(value);

      if (tokens.length > 0) this.runs[zone].push(tokens);
    }
  }

  /** Rich-text fields hold TipTap HTML; tag names are not resume content. */
  addRich(zone: ResumeZone, html: string): void {
    this.add(zone, richTextToPlainText(html));
  }

  addList(zone: ResumeZone, values: readonly string[]): void {
    this.add(zone, ...values);
  }

  result(): Record<ResumeZone, string[][]> {
    return this.runs;
  }
}

export interface BuildResumeIndexOptions {
  /** `YYYY-MM` or later. Passed in rather than read, so scores are reproducible. */
  readonly asOf: string;
}

export function buildResumeIndex(
  document: ResumeDocument,
  options: BuildResumeIndexOptions,
): ResumeIndex {
  const collector = new ZoneCollector();
  const ranges: DateRange[] = [];
  const asOfMonth = toMonthIndex(options.asOf) ?? 0;

  const { basics } = document;

  collector.add("summary", basics.headline);

  for (const section of document.sections) {
    if (!section.visible) continue;

    switch (section.kind) {
      case "summary":
        collector.addRich("summary", section.content);
        break;

      case "experience":
        for (const item of section.items) {
          collector.add("experience", item.position, item.company);
          collector.addRich("experience", item.summary);
          collector.addList("experience", item.highlights);
          collector.addList("experience", item.technologies);

          const range = toRange(item, asOfMonth);

          if (range) ranges.push(range);
        }
        break;

      case "projects":
        for (const item of section.items) {
          collector.add("projects", item.name, item.role);
          collector.addRich("projects", item.description);
          collector.addList("projects", item.highlights);
          collector.addList("projects", item.technologies);
        }
        break;

      case "skills":
        for (const item of section.items) {
          collector.add("skills", item.name, item.category);
          collector.addList("skills", item.keywords);
        }
        break;

      case "languages":
        for (const item of section.items) collector.add("skills", item.name);
        break;

      case "interests":
        for (const item of section.items) {
          collector.add("skills", item.name);
          collector.addList("skills", item.keywords);
        }
        break;

      case "education":
        for (const item of section.items) {
          collector.add("education", item.institution, item.degree, item.area);
          collector.addRich("education", item.summary);
          collector.addList("education", item.highlights);
        }
        break;

      case "certifications":
        for (const item of section.items) collector.add("education", item.name, item.issuer);
        break;

      case "awards":
        for (const item of section.items) {
          collector.add("other", item.title, item.issuer);
          collector.addRich("other", item.summary);
        }
        break;

      case "publications":
        for (const item of section.items) {
          collector.add("other", item.name, item.publisher);
          collector.addRich("other", item.summary);
        }
        break;

      case "custom":
        for (const item of section.items) {
          collector.add("other", item.name, item.subtitle);
          collector.addRich("other", item.description);
          collector.addList("other", item.highlights);
        }
        break;

      // References are the candidate's referees, not the candidate's experience.
      case "references":
        break;
    }
  }

  return {
    zones: collector.result(),
    experienceMonths: mergedMonths(ranges),
    headline: tokenize(basics.headline),
  };
}

/**
 * Every zone containing `phrase`, in `RESUME_ZONES` order.
 *
 * Order is fixed rather than document order so the report reads the same way twice, and
 * so "strongest evidence first" is a property of the array rather than of the caller.
 */
export function findZones(index: ResumeIndex, phrase: readonly string[]): ResumeZone[] {
  return RESUME_ZONES.filter((zone) =>
    index.zones[zone].some((run) => includesPhrase(run, phrase)),
  );
}
