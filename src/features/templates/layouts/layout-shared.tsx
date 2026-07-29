/**
 * What every layout is handed, and the two things all of them do with it.
 *
 * Six layouts differ in where boxes sit, not in what goes inside them: each one renders the
 * header, then a stack of sections, and the interesting part is the geometry. Keeping the
 * props type and the stack here means a change to how a section list is spaced happens once
 * — and means the renderer's switch can type every branch against one interface.
 *
 * Hook-free and directive-free like the rest of `features/templates`; see the header of
 * `resume-atoms.tsx` for why that constraint exists.
 */

import type { ResumeDocument, ResumeSection } from "@/types/resume";

import { SectionBlock } from "../components/resume-sections";
import type { ResolvedTemplate } from "../lib/resolve-template";

export interface LayoutProps {
  template: ResolvedTemplate;
  document: ResumeDocument;
}

/**
 * Bounds on `tokens.asideWidthPct`, applied here rather than trusted from the registry.
 *
 * Below the floor, skill pills wrap one per line and the column reads as a list of orphans;
 * above the ceiling the main column stops holding a bullet on one line. A registry typo of
 * `340` would otherwise render a page that is entirely sidebar.
 */
export const ASIDE_WIDTH_MIN_PCT = 26;
export const ASIDE_WIDTH_MAX_PCT = 42;
export const ASIDE_WIDTH_DEFAULT_PCT = 34;

export function asideWidthPct(template: ResolvedTemplate): number {
  const requested = template.definition.tokens.asideWidthPct ?? ASIDE_WIDTH_DEFAULT_PCT;

  if (!Number.isFinite(requested)) {
    return ASIDE_WIDTH_DEFAULT_PCT;
  }

  return Math.min(ASIDE_WIDTH_MAX_PCT, Math.max(ASIDE_WIDTH_MIN_PCT, requested));
}

export interface SectionStackProps {
  template: ResolvedTemplate;
  sections: readonly ResumeSection[];
  /** Defaults to the template's section rhythm; a narrow column may want it tighter. */
  gap?: number;
}

/**
 * A column of sections in document order.
 *
 * Order is never touched — not sorted, not grouped, not hoisted. Reordering in the editor is
 * a change to this array, so a layout that "improved" the order would silently undo the drag
 * the user just performed.
 */
export function SectionStack({ template, sections, gap }: SectionStackProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: gap ?? template.spacing.sectionGapPx,
      }}
    >
      {sections.map((section) => (
        <SectionBlock key={section.id} template={template} section={section} />
      ))}
    </div>
  );
}
