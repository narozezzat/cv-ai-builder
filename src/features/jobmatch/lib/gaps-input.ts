/**
 * The second AI call's input: the score, plus just enough resume to advise on it.
 *
 * The gap prompt is told which requirements were met and which were not — the numbers
 * are already decided by `scoreJobMatch`, so the model is asked only to explain and
 * prioritise. Giving it the covered list as well as the missing one is what stops it
 * recommending something the resume already says.
 *
 * `features/resume` has an equivalent document-to-prompt mapper in `lib/ai-context.ts`,
 * and this file deliberately does not reuse it. Reaching for it would mean
 * `features/jobmatch` importing `features/resume` while `features/resume` mounts this
 * feature's dialog — a module cycle for the sake of thirty lines. The dependency runs one
 * way: resume imports jobmatch, never the reverse.
 *
 * Types come from the prompt layer with `import type`, which erases — `@/services/ai` is
 * `server-only` and this module runs in the browser.
 */

import type { JobMatchExtractOutput, JobMatchGapsInput } from "@/services/ai";
import { RESUME_LIMITS, type ExperienceItem, type ResumeDocument } from "@/types/resume";
import { richTextToPlainText } from "@/utils/rich-text";

import type { AtsScore } from "./ats-score";

/** `gapsInputSchema.experience`, which is stricter than the document's own cap. */
const MAX_EXPERIENCE_ENTRIES = 8;

/** `experienceEntrySchema.highlights`. The document allows 30 per item. */
const MAX_ENTRY_HIGHLIGHTS = 20;

/** `gapsInputSchema.matchedKeywords` / `.missingKeywords`. */
const MAX_KEYWORDS = 60;

function present(value: string, max: number): string | undefined {
  const trimmed = value.trim().slice(0, max);

  return trimmed.length > 0 ? trimmed : undefined;
}

function formatPeriod(item: ExperienceItem): string | undefined {
  const start = item.startDate.trim();
  const end = item.current ? "Present" : item.endDate.trim();

  if (start && end) return `${start} – ${end}`;

  return present(start || end, RESUME_LIMITS.shortText);
}

/**
 * Visible, titled roles in document order, capped at what the schema accepts.
 *
 * A titleless row is dropped rather than sent: `position` is required server-side, so it
 * would fail validation and cost the user a request for a row they are mid-way through
 * typing.
 */
function buildExperience(document: ResumeDocument): JobMatchGapsInput["experience"] {
  const entries: NonNullable<JobMatchGapsInput["experience"]> = [];

  for (const section of document.sections) {
    if (section.kind !== "experience" || !section.visible) continue;

    for (const item of section.items) {
      if (entries.length >= MAX_EXPERIENCE_ENTRIES) return entries;

      const position = present(item.position, RESUME_LIMITS.shortText);

      if (!position) continue;

      entries.push({
        position,
        company: present(item.company, RESUME_LIMITS.nameText),
        period: formatPeriod(item),
        highlights: item.highlights
          .map((highlight) => highlight.trim().slice(0, RESUME_LIMITS.highlightText))
          .filter((highlight) => highlight.length > 0)
          .slice(0, MAX_ENTRY_HIGHLIGHTS),
      });
    }
  }

  return entries;
}

/** The summary section as plain text — the prompt gets prose, never TipTap HTML. */
function buildSummary(document: ResumeDocument): string | undefined {
  for (const section of document.sections) {
    if (section.kind !== "summary" || !section.visible) continue;

    const text = present(richTextToPlainText(section.content), RESUME_LIMITS.sectionRichText);

    if (text) return text;
  }

  return undefined;
}

export function buildGapsInput(
  posting: JobMatchExtractOutput,
  score: AtsScore,
  document: ResumeDocument,
): JobMatchGapsInput {
  return {
    jobTitle: present(posting.jobTitle, RESUME_LIMITS.shortText) ?? "this role",
    seniority: posting.seniority,
    matchedKeywords: score.matched
      .map((verdict) => verdict.keyword.slice(0, RESUME_LIMITS.keywordText))
      .slice(0, MAX_KEYWORDS),
    // Already ordered required-first, so a truncated list keeps the ones that matter.
    missingKeywords: score.missing
      .map((verdict) => verdict.keyword.slice(0, RESUME_LIMITS.keywordText))
      .slice(0, MAX_KEYWORDS),
    summary: buildSummary(document),
    experience: buildExperience(document),
  };
}
