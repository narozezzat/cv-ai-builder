/**
 * The default layout: header, then every visible section in the user's order, one column.
 *
 * Section order is the document's order, untouched — reordering in the editor is a change
 * to the array, so the layout must not sort, group, or hoist anything. A layout that put
 * experience before education "because that reads better" would silently undo the drag the
 * user just performed.
 *
 * Like everything under `features/templates`, this is hook-free and directive-free: the
 * same tree renders in the client preview, in the server print route, and on the public
 * share page.
 */

import type { ResumeDocument } from "@/types/resume";

import { ResumeHeader } from "../components/resume-header";
import { isSectionRendered, SectionBlock } from "../components/resume-sections";
import type { ResolvedTemplate } from "../lib/resolve-template";

export interface LayoutProps {
  template: ResolvedTemplate;
  document: ResumeDocument;
}

export function SingleColumnLayout({ template, document }: LayoutProps) {
  const sections = document.sections.filter(isSectionRendered);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: template.spacing.sectionGapPx,
      }}
    >
      <ResumeHeader template={template} basics={document.basics} />
      {sections.map((section) => (
        <SectionBlock key={section.id} template={template} section={section} />
      ))}
    </div>
  );
}
