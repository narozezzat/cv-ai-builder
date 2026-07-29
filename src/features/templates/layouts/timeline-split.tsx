/**
 * Section headings in a left gutter, bodies in a column behind a vertical rule.
 *
 * This is the one layout that does not compose `SectionBlock`: it needs the heading and the
 * body in two different boxes, which is why `resume-sections.tsx` exports `SectionBody`
 * separately. `SectionShell` would stack them.
 *
 * The rule is a `borderLeft` on the body, not a separate element — a bordered box grows with
 * its content and survives a page break, whereas an absolutely positioned line would need a
 * measured height that does not exist before layout.
 */

import { SectionTitle } from "../components/resume-atoms";
import { ResumeHeader } from "../components/resume-header";
import { isSectionRendered, SectionBody } from "../components/resume-sections";
import type { LayoutProps } from "./layout-shared";

/** Share of the content width given to the heading gutter. */
const GUTTER_PCT = 24;

export function TimelineSplitLayout({ template, document }: LayoutProps) {
  const sections = document.sections.filter(isSectionRendered);
  const { spacing, colors } = template;
  const gutterGap = spacing.sectionGapPx * 0.75;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.sectionGapPx }}>
      <ResumeHeader
        template={template}
        basics={document.basics}
        align={template.definition.tokens.headerAlign}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.sectionGapPx }}>
        {sections.map((section) => (
          <section key={section.id} style={{ display: "flex", gap: gutterGap }}>
            <div style={{ flex: `0 0 ${GUTTER_PCT}%`, maxWidth: `${GUTTER_PCT}%` }}>
              <SectionTitle template={template} title={section.title} />
            </div>
            <div
              style={{
                // Without this a long unbroken URL in a bullet pushes the body past its basis
                // and collapses the gutter to nothing.
                minWidth: 0,
                flex: "1 1 0",
                borderLeft: `1px solid ${colors.rule}`,
                paddingLeft: gutterGap,
              }}
            >
              <SectionBody template={template} section={section} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
