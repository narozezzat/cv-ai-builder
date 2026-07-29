/**
 * Two equal columns of sections under a full-width header.
 *
 * Unlike the sidebar layouts this does not sort sections by kind — `splitBalancedSections`
 * cuts the document order at the point where the estimated heights match, so the user's
 * ordering still reads down the left column and continues down the right. A weight-based cut
 * beats "half the sections each": one experience section with eight roles is not the same
 * height as four two-line ones.
 *
 * No fill and no bleed here, so both columns are plain flex items. The `minWidth: 0` on each
 * is load-bearing: a long unbroken URL in a bullet would otherwise push its column past the
 * basis and squeeze the other one flat.
 */

import { ResumeHeader } from "../components/resume-header";
import { splitBalancedSections } from "../lib/section-columns";
import { SectionStack, type LayoutProps } from "./layout-shared";

export function TwoColumnBalancedLayout({ template, document }: LayoutProps) {
  const { left, right } = splitBalancedSections(document.sections);
  const { spacing } = template;

  const header = (
    <ResumeHeader
      template={template}
      basics={document.basics}
      align={template.definition.tokens.headerAlign}
    />
  );

  // One section, or a document whose weight all lands in one column. A row with an empty
  // half would print the whole resume at 50% width for no reason.
  if (right.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.sectionGapPx }}>
        {header}
        <SectionStack template={template} sections={left} />
      </div>
    );
  }

  const column = {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    flex: "1 1 0",
    gap: spacing.sectionGapPx,
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.sectionGapPx }}>
      {header}
      <div style={{ display: "flex", alignItems: "flex-start", gap: spacing.sectionGapPx * 1.25 }}>
        <div style={column}>
          <SectionStack template={template} sections={left} />
        </div>
        <div style={column}>
          <SectionStack template={template} sections={right} />
        </div>
      </div>
    </div>
  );
}
