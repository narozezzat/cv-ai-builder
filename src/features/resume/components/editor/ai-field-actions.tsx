"use client";

/**
 * The AI triggers that sit beside the editor's field labels.
 *
 * They live here rather than inline in `item-fields.tsx` for two reasons. First, the
 * per-kind field components receive only `{ sectionId, item }` — anything that needs
 * the whole document to build a prompt context has to read the store itself, and doing
 * that inside the field components would give every one of the eleven a store
 * subscription it does not use. Second, each trigger is a mapping between a
 * capability's output type and one field's payload kind, and that mapping is the part
 * worth reading in one place.
 *
 * Three rules hold across all of them:
 *
 * 1. **Payload kind matches the field.** A text field's popover only ever emits
 *    `{ kind: "text" }`, a list field's only `{ kind: "list" }`. That is why
 *    `experience.rewrite` — which returns prose *and* bullets — surfaces on the summary
 *    field with its bullets as read-only notes, while the bullets themselves get their
 *    own capabilities on the highlights field.
 * 2. **Plain text in, plain text out.** Rich-text call sites strip HTML on the way in
 *    and rebuild it with `plainTextToRichText` on accept; the model never sees a tag.
 * 3. **A trigger the user cannot use says why.** Every prerequisite that comes from a
 *    prompt's input schema — `roleTitle` being required, a subject being non-empty, a
 *    bullet list being non-empty — is a `disabled` + `disabledReason` pair, not a
 *    request that fails validation server-side after spending the round trip.
 */

import {
  AiSuggestionPopover,
  fixGrammarAction,
  generateKeywordsAction,
  generateSummaryAction,
  improveBulletsAction,
  rewriteExperienceAction,
  rewriteForAtsAction,
  suggestAchievementsAction,
  suggestionId,
  type ListSuggestion,
  type TextSuggestion,
} from "@/features/ai";
import { RESUME_LIMITS, type ExperienceItem, type SkillItem } from "@/types/resume";
import { isRichTextEmpty, plainTextToRichText, richTextToPlainText } from "@/utils/rich-text";

import { buildAiContext, buildAiExperience, buildAiRole } from "../../lib/ai-context";
import { applyImprovedBullets, bulletsForRequest } from "../../lib/improve-bullets";
import { selectDocument, useResumeStore } from "../../store/resume-store";

/** `AI_INPUT_LIMITS.fieldText`, restated because that constant is server-only. */
const MAX_FIELD_TEXT = RESUME_LIMITS.sectionRichText;

/**
 * The order `summary.generate` promises: achievement-led, skills-led, narrative.
 *
 * Labels, not headings — they name the variant in the popover footer so paging
 * through three options is a choice between angles rather than three unlabelled
 * rerolls. A fourth variant would fall back to its ordinal.
 */
const SUMMARY_VARIANT_LABELS = ["Achievement-led", "Skills-led", "Narrative"] as const;

/** Two triggers fit a label row. Three crowd it. */
function ActionRow({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center gap-0.5">{children}</span>;
}

function toPlainText(html: string): string {
  return richTextToPlainText(html).slice(0, MAX_FIELD_TEXT);
}

/** Keywords the model says it worked in, as one display-only line. */
function keywordNote(label: string, keywords: readonly string[]): string[] {
  return keywords.length > 0 ? [`${label} ${keywords.join(", ")}`] : [];
}

// ── Section summary ───────────────────────────────────────────────────────────

interface SummaryFieldActionsProps {
  /** Stored HTML, the same value the field renders. */
  value: string;
  onAccept: (html: string) => void;
}

/**
 * Write and proofread, for the summary section.
 *
 * `summary.generate` charges once for up to three variants, so paging between them is
 * free — the reason the popover distinguishes "Next option" from "Regenerate".
 */
export function SummaryFieldActions({ value, onAccept }: SummaryFieldActionsProps) {
  const document = useResumeStore(selectDocument);
  const resumeId = useResumeStore((state) => state.resumeId);
  const current = toPlainText(value);
  const empty = isRichTextEmpty(value);

  return (
    <ActionRow>
      <AiSuggestionPopover
        label="Write with AI"
        title="Professional summary"
        description="Three angles on the same career. Pick one, then edit it — it is a draft, not a verdict."
        value={{ kind: "text", text: current }}
        limits={{ maxItems: 1, maxLength: MAX_FIELD_TEXT }}
        run={() =>
          generateSummaryAction(
            {
              context: buildAiContext(document),
              currentSummary: current || undefined,
              experience: buildAiExperience(document),
            },
            { resumeId },
          )
        }
        toSuggestions={(data): TextSuggestion[] =>
          data.variants.map((text, index) => ({
            kind: "text",
            id: suggestionId("summary", index),
            label: SUMMARY_VARIANT_LABELS[index] ?? `Option ${index + 1}`,
            text,
            notes: keywordNote("Keywords worked in:", data.keywords),
          }))
        }
        onAccept={(payload) => {
          if (payload.kind === "text") onAccept(plainTextToRichText(payload.text));
        }}
      />

      <AiSuggestionPopover
        label="Proofread"
        title="Grammar and spelling"
        description="Fixes mistakes only. Nothing is rephrased and no claim is added."
        value={{ kind: "text", text: current }}
        disabled={empty}
        disabledReason="write a summary first"
        run={() => fixGrammarAction({ text: current }, { resumeId })}
        toSuggestions={(data): TextSuggestion[] => [
          {
            kind: "text",
            id: suggestionId("grammar", 0),
            text: data.text,
            notes: data.corrections.map(
              (correction) => `${correction.before} → ${correction.after} (${correction.reason})`,
            ),
          },
        ]}
        onAccept={(payload) => {
          if (payload.kind === "text") onAccept(plainTextToRichText(payload.text));
        }}
      />
    </ActionRow>
  );
}

// ── Experience: summary ───────────────────────────────────────────────────────

interface ExperienceSummaryActionsProps {
  item: ExperienceItem;
  onAccept: (html: string) => void;
}

/**
 * Rewrite and ATS-rewrite, for one role's description.
 *
 * `experience.rewrite` may answer `summary: null` when it judges the bullets say
 * everything — the field then has nothing to offer, which the popover reports as an
 * empty result. Returning the bullets as the summary instead would put bullet text in
 * a prose field, and the highlights field has its own capabilities for them.
 */
export function ExperienceSummaryActions({ item, onAccept }: ExperienceSummaryActionsProps) {
  const document = useResumeStore(selectDocument);
  const resumeId = useResumeStore((state) => state.resumeId);
  const current = toPlainText(item.summary);
  const hasTitle = item.position.trim().length > 0;

  return (
    <ActionRow>
      <AiSuggestionPopover
        label="Rewrite"
        title="Rewrite this role"
        description="Uses the title, company, dates, and technologies you have entered. It will not invent a metric."
        value={{ kind: "text", text: current }}
        disabled={!hasTitle}
        disabledReason="add a job title first"
        run={() =>
          rewriteExperienceAction(
            { context: buildAiContext(document), role: buildAiRole(item) },
            { resumeId },
          )
        }
        toSuggestions={(data): TextSuggestion[] =>
          data.summary === null
            ? []
            : [
                {
                  kind: "text",
                  id: suggestionId("rewrite", 0),
                  text: data.summary,
                  notes:
                    data.bullets.length > 0
                      ? [
                          "It also suggested these bullets — reference only, apply them from Highlights:",
                          ...data.bullets,
                        ]
                      : [],
                },
              ]
        }
        onAccept={(payload) => {
          if (payload.kind === "text") onAccept(plainTextToRichText(payload.text));
        }}
      />

      <AiSuggestionPopover
        label="ATS"
        title="Rewrite for keyword scans"
        description="Same facts, phrased the way a parser reads them. Your technologies are the target keywords."
        value={{ kind: "text", text: current }}
        disabled={current.length === 0}
        disabledReason="write a summary first"
        run={() =>
          rewriteForAtsAction(
            {
              context: buildAiContext(document),
              text: current,
              targetKeywords: buildAiRole(item).technologies,
            },
            { resumeId },
          )
        }
        toSuggestions={(data): TextSuggestion[] => [
          {
            kind: "text",
            id: suggestionId("ats", 0),
            text: data.text,
            notes: [
              ...keywordNote("Worked in:", data.keywordsUsed),
              ...keywordNote("Left out as unsupported:", data.keywordsSkipped),
            ],
          },
        ]}
        onAccept={(payload) => {
          if (payload.kind === "text") onAccept(plainTextToRichText(payload.text));
        }}
      />
    </ActionRow>
  );
}

// ── Experience: highlights ────────────────────────────────────────────────────

interface HighlightsActionsProps {
  item: ExperienceItem;
  onAccept: (next: string[]) => void;
}

/** Improve what is there, or suggest what is missing. */
export function HighlightsActions({ item, onAccept }: HighlightsActionsProps) {
  const document = useResumeStore(selectDocument);
  const resumeId = useResumeStore((state) => state.resumeId);
  const requestBullets = bulletsForRequest(item.highlights);
  const hasTitle = item.position.trim().length > 0;
  const limits = {
    maxItems: RESUME_LIMITS.highlightsPerItem,
    maxLength: RESUME_LIMITS.highlightText,
  };

  return (
    <ActionRow>
      <AiSuggestionPopover
        label="Improve"
        title="Sharpen these bullets"
        description="Stronger verbs, tighter phrasing, your numbers kept as they are."
        value={{ kind: "list", items: item.highlights }}
        limits={limits}
        disabled={requestBullets.length === 0}
        disabledReason="write at least one bullet first"
        run={() =>
          improveBulletsAction(
            {
              context: buildAiContext(document),
              roleTitle: item.position.trim() || undefined,
              bullets: requestBullets,
            },
            { resumeId },
          )
        }
        toSuggestions={(data): ListSuggestion[] => [
          {
            kind: "list",
            id: suggestionId("improve", 0),
            items: applyImprovedBullets(item.highlights, data.bullets),
            mode: "replace",
          },
        ]}
        onAccept={(payload) => {
          if (payload.kind === "list") onAccept(payload.items);
        }}
      />

      <AiSuggestionPopover
        label="Suggest"
        title="Achievements to add"
        description="Shapes worth claiming for this role. Anything in square brackets is a number only you have."
        value={{ kind: "list", items: item.highlights }}
        limits={limits}
        disabled={!hasTitle}
        disabledReason="add a job title first"
        run={() =>
          suggestAchievementsAction(
            {
              context: buildAiContext(document),
              roleTitle: item.position.trim().slice(0, RESUME_LIMITS.shortText),
              company: item.company.trim() || undefined,
              // Bounded to thirty rather than the twelve `bullets.improve` takes:
              // "do not repeat what is already there" only works if it sees all of it.
              existingHighlights: buildAiRole(item).highlights,
            },
            { resumeId },
          )
        }
        toSuggestions={(data): ListSuggestion[] => [
          {
            kind: "list",
            id: suggestionId("achievements", 0),
            items: data.achievements,
            mode: "append",
            notes: keywordNote("Numbers worth digging up:", data.metricsToGather),
          },
        ]}
        onAccept={(payload) => {
          if (payload.kind === "list") onAccept(payload.items);
        }}
      />
    </ActionRow>
  );
}

// ── Keyword lists ─────────────────────────────────────────────────────────────

interface KeywordActionsProps {
  /** Chips already in the field: the merge base and the dedupe source. */
  value: string[];
  /** Free text the capability reasons from — a role, a skill, a section. */
  subject: string;
  maxItems: number;
  /** Named in the disabled announcement, e.g. "add a job title first". */
  disabledReason: string;
  onAccept: (next: string[]) => void;
}

/**
 * `keywords.generate`, for any chip list.
 *
 * One component for both call sites because the capability's only input is a subject
 * string; what differs between a role's technologies and a skill's related keywords is
 * which fields that string is built from, which is the caller's business.
 */
export function KeywordActions({
  value,
  subject,
  maxItems,
  disabledReason,
  onAccept,
}: KeywordActionsProps) {
  const document = useResumeStore(selectDocument);
  const resumeId = useResumeStore((state) => state.resumeId);
  const trimmedSubject = subject.trim().slice(0, MAX_FIELD_TEXT);

  return (
    <AiSuggestionPopover
      label="Suggest"
      title="Keywords to add"
      description="Tick the ones you can back up in an interview. Ones you already have are filtered out."
      value={{ kind: "list", items: value }}
      limits={{ maxItems, maxLength: RESUME_LIMITS.keywordText }}
      disabled={trimmedSubject.length === 0}
      disabledReason={disabledReason}
      run={() =>
        generateKeywordsAction(
          { context: buildAiContext(document), subject: trimmedSubject },
          { resumeId },
        )
      }
      toSuggestions={(data): ListSuggestion[] => [
        {
          kind: "list",
          id: suggestionId("keywords", 0),
          items: data.keywords,
          mode: "append",
        },
      ]}
      onAccept={(payload) => {
        if (payload.kind === "list") onAccept(payload.items);
      }}
    />
  );
}

/** The subject for a role's technology list: what was done, and where. */
export function experienceKeywordSubject(item: ExperienceItem): string {
  return [item.position, item.company, toPlainText(item.summary)]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" — ");
}

/** The subject for a skill's related keywords: the skill, and its grouping. */
export function skillKeywordSubject(item: SkillItem): string {
  const name = item.name.trim();
  const category = item.category.trim();

  return name.length > 0 && category.length > 0 ? `${name} (${category})` : name;
}
