/**
 * The one component that turns a stored resume into a page.
 *
 * Live preview, the print route Chromium navigates to, and the public share page all
 * render *this*, from the same `ResumeRenderInput`. That is what makes "the PDF matches
 * what you saw" structural rather than a promise: there is no second renderer to drift.
 *
 * No `"use client"`, no hooks — see the header of `resume-atoms.tsx` for why.
 */

import type { ResumeRenderInput } from "@/types/resume";

import { HeaderBannerLayout } from "../layouts/header-banner";
import { SidebarLayout } from "../layouts/sidebar";
import { SingleColumnLayout } from "../layouts/single-column";
import { TimelineSplitLayout } from "../layouts/timeline-split";
import { TwoColumnBalancedLayout } from "../layouts/two-column-balanced";
import { resumeFontFamily } from "../lib/fonts";
import { proseScope, resumeStyles } from "../lib/page-styles";
import { resolveTemplate, type ResolvedTemplate } from "../lib/resolve-template";

export interface ResumeRendererProps extends ResumeRenderInput {
  /**
   * Marks this page as the export target. The print route sets it so Puppeteer can wait
   * for a selector that only exists once the document has actually rendered, instead of
   * racing a fixed timeout.
   */
  printTarget?: boolean;
}

export function ResumeRenderer({
  document,
  theme,
  page,
  templateId,
  printTarget = false,
}: ResumeRendererProps) {
  const template = resolveTemplate({ templateId, theme, page });
  const scope = proseScope(template);

  return (
    <article
      data-resume-page={printTarget ? "print" : "preview"}
      data-resume-scope={scope}
      style={{
        boxSizing: "border-box",
        width: template.page.widthPx,
        // `minHeight`, not `height`: a two-page resume is longer than one sheet, and
        // Chromium paginates it. A fixed height would clip the second page.
        minHeight: template.page.heightPx,
        padding: template.page.marginPx,
        backgroundColor: template.colors.surface,
        color: template.colors.body,
        fontFamily: resumeFontFamily(template.fonts.body),
        fontSize: template.type.bodyPx,
        lineHeight: template.type.lineHeight,
        // Chromium drops backgrounds when printing unless told not to, which would erase
        // filled section bars and every accent pill.
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      {/*
        Rich-text rules, page-break control, and — on the print target only — the `@page`
        box. See `page-styles.ts` for why the renderer carries its own stylesheet and why
        `@page` cannot be emitted from a preview.
      */}
      <style dangerouslySetInnerHTML={{ __html: resumeStyles(template, scope, { printTarget }) }} />
      {renderLayout(template, document)}
    </article>
  );
}

function renderLayout(template: ResolvedTemplate, document: ResumeRenderInput["document"]) {
  switch (template.definition.layout) {
    case "single-column":
      return <SingleColumnLayout template={template} document={document} />;

    case "sidebar-left":
      return <SidebarLayout template={template} document={document} side="left" />;

    case "sidebar-right":
      return <SidebarLayout template={template} document={document} side="right" />;

    case "header-banner":
      return <HeaderBannerLayout template={template} document={document} />;

    case "timeline-split":
      return <TimelineSplitLayout template={template} document={document} />;

    case "two-column-balanced":
      return <TwoColumnBalancedLayout template={template} document={document} />;

    default: {
      // Exhaustiveness check: a registry entry naming a layout with no component here
      // fails to compile rather than rendering a blank page.
      const unhandled: never = template.definition.layout;
      return unhandled;
    }
  }
}
