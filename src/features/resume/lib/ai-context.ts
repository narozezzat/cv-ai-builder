/**
 * The document, reduced to what an AI capability actually needs.
 *
 * Every inline AI action takes a `context` and, for the ones that reason about a
 * career, a flattened `experience` list. Building those at each call site would put
 * the mapping in a dozen components and make a renamed document field a dozen
 * separate bugs, so it happens once, here.
 *
 * Four constraints drive the shape:
 *
 * 1. **The whole document is never the prompt.** The prompt layer's input schemas
 *    are narrow on purpose — prompt length is cost, and sharpening one bullet does
 *    not need someone's 2014 internship. This module is where that reduction lives.
 * 2. **The prompt schemas are stricter than the document.** `position` is required
 *    there and merely bounded here, an entry's `highlights` cap at 20 there and 30
 *    here, and `experience` caps at 12 entries. A value that would fail validation
 *    server-side is dropped or sliced here rather than sent and rejected.
 * 3. **Everything sent is plain text.** Rich-text fields hold TipTap HTML; a model
 *    given HTML spends tokens on tags and answers in them. `summary` is flattened
 *    on the way out, the same as every other rich-text call site.
 * 4. **Types come from the prompt layer, not a hand-written mirror.** Importing
 *    `ResumeContextInput` means a schema change breaks this file at typecheck. The
 *    import is `import type`: `@/services/ai` is `server-only`, and these builders
 *    run inside client components.
 */

import type {
  ExperienceEntryInput,
  ExperienceRewriteInput,
  ResumeContextInput,
} from "@/services/ai";
import { RESUME_LIMITS, type ExperienceItem, type ResumeDocument } from "@/types/resume";
import { richTextToPlainText } from "@/utils/rich-text";

/** The prompt layer's per-role shape, which is richer than a context entry. */
export type ExperienceRoleInput = ExperienceRewriteInput["role"];

/** `experienceEntrySchema.highlights`. The document allows 30 per item. */
const MAX_ENTRY_HIGHLIGHTS = 20;

/** Every capability that takes a work history caps it at 12 roles. */
const MAX_EXPERIENCE_ENTRIES = 12;

/** `AI_INPUT_LIMITS.listItems`, restated because that constant is server-only. */
const MAX_LIST_ITEMS = 40;

/**
 * Seniority words we will assert on the user's behalf.
 *
 * Only what the headline literally says. Inferring "senior" from a year count is a
 * claim about someone's career that the model would then repeat back as fact in a
 * summary they are likely to accept without reading closely.
 *
 * Order matters — first match wins, so a title carrying two of these resolves to the
 * one listed later only if the earlier one is absent.
 */
const SENIORITY_TERMS = [
  "intern",
  "junior",
  "graduate",
  "entry level",
  "associate",
  "mid-level",
  "senior",
  "staff",
  "principal",
  "lead",
  "head",
  "director",
  "vp",
  "chief",
  "founder",
] as const;

/** Empty means "not supplied", which the document spells `""` and a prompt `undefined`. */
function present(value: string, max: number): string | undefined {
  const trimmed = value.trim().slice(0, max);

  return trimmed.length > 0 ? trimmed : undefined;
}

/** Trimmed, non-empty, bounded, capped — the shape every list input wants. */
function boundedList(values: readonly string[], max: number, limit: number): string[] {
  return values
    .map((value) => value.trim().slice(0, max))
    .filter((value) => value.length > 0)
    .slice(0, limit);
}

function detectSeniority(headline: string): string | undefined {
  const lowered = headline.toLowerCase();

  return SENIORITY_TERMS.find((term) => lowered.includes(term));
}

/**
 * Skill names and their keywords, flattened and deduplicated case-insensitively.
 *
 * Both halves matter: a skills item is often a category ("Cloud") whose keywords are
 * the real technologies, and often the reverse. Sending both is what lets "do not
 * repeat skills already on the resume" mean anything.
 */
export function collectExistingSkills(document: ResumeDocument): string[] {
  const seen = new Set<string>();
  const skills: string[] = [];

  for (const section of document.sections) {
    if (section.kind !== "skills" || !section.visible) continue;

    for (const item of section.items) {
      for (const candidate of [item.name, ...item.keywords]) {
        if (skills.length >= MAX_LIST_ITEMS) return skills;

        // A skill *name* may be up to `nameText`, longer than a keyword is allowed
        // to be, so it is truncated rather than dropped.
        const value = present(candidate, RESUME_LIMITS.keywordText);

        if (!value || seen.has(value.toLowerCase())) continue;

        seen.add(value.toLowerCase());
        skills.push(value);
      }
    }
  }

  return skills;
}

/**
 * The dates as a human reads them: `2021-03 – Present`.
 *
 * Formatted rather than sent as two fields because the model uses it only to judge
 * tense and duration, and one line costs fewer tokens than a labelled pair.
 */
export function formatPeriod(
  item: Pick<ExperienceItem, "startDate" | "endDate" | "current">,
): string | undefined {
  const start = item.startDate.trim();
  const end = item.current ? "Present" : item.endDate.trim();

  if (start && end) return `${start} – ${end}`;

  return present(start || end, RESUME_LIMITS.shortText);
}

/**
 * One job in the shape `experienceEntrySchema` wants, or `null` if it has no title.
 *
 * `position` is `requiredText` server-side, so a half-filled row — the normal state
 * of an editor someone is typing into — is dropped rather than sent and rejected.
 */
function toExperienceEntry(item: ExperienceItem): ExperienceEntryInput | null {
  const position = present(item.position, RESUME_LIMITS.shortText);

  if (!position) return null;

  return {
    position,
    company: present(item.company, RESUME_LIMITS.nameText),
    period: formatPeriod(item),
    highlights: boundedList(item.highlights, RESUME_LIMITS.highlightText, MAX_ENTRY_HIGHLIGHTS),
  };
}

/**
 * Visible experience in the order the user arranged it, capped at 12 roles.
 *
 * Hidden sections are excluded: a section toggled off is not on the resume being
 * tailored, so it should not steer what the model suggests for it either.
 */
export function buildAiExperience(document: ResumeDocument): ExperienceEntryInput[] {
  const entries: ExperienceEntryInput[] = [];

  for (const section of document.sections) {
    if (section.kind !== "experience" || !section.visible) continue;

    for (const item of section.items) {
      if (entries.length >= MAX_EXPERIENCE_ENTRIES) return entries;

      const entry = toExperienceEntry(item);

      if (entry) entries.push(entry);
    }
  }

  return entries;
}

/**
 * Who the user is aiming to be, as far as the document says.
 *
 * `industry` is always absent here: the document has no field for it, and guessing
 * one from a job title is the kind of invented premise that produces a summary
 * claiming domain experience the user never had. It stays in the schema because the
 * job-match flow supplies it from a posting, where it is stated rather than inferred.
 */
export function buildAiContext(document: ResumeDocument): ResumeContextInput {
  const headline = document.basics.headline.trim();

  return {
    targetRole: present(headline, RESUME_LIMITS.shortText),
    industry: undefined,
    seniority: detectSeniority(headline),
    existingSkills: collectExistingSkills(document),
  };
}

/**
 * The full role, for capabilities that rewrite one job rather than survey all of
 * them. Unlike `buildAiExperience` this keeps a titleless role: the caller gates its
 * trigger on the title instead, so it can say *why* the button is disabled.
 */
export function buildAiRole(item: ExperienceItem): ExperienceRoleInput {
  return {
    position: item.position.trim().slice(0, RESUME_LIMITS.shortText),
    company: present(item.company, RESUME_LIMITS.nameText),
    period: formatPeriod(item),
    summary: present(richTextToPlainText(item.summary), RESUME_LIMITS.itemRichText),
    highlights: boundedList(
      item.highlights,
      RESUME_LIMITS.highlightText,
      RESUME_LIMITS.highlightsPerItem,
    ),
    technologies: boundedList(item.technologies, RESUME_LIMITS.keywordText, MAX_LIST_ITEMS),
  };
}
