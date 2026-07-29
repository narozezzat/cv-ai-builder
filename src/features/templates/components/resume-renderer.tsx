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
        Rich text arrives as an HTML string, so it cannot carry inline styles the way the
        rest of this tree does — it needs a stylesheet, and the print route and share page
        are exactly the contexts where the app's stylesheet may not be in the tree. So the
        renderer ships its own, scoped to this page. Only template-derived numbers and the
        already hex-validated palette are interpolated; no user text reaches this string.
      */}
      <style dangerouslySetInnerHTML={{ __html: proseStyles(template, scope) }} />
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

/**
 * A per-page scope for the prose CSS.
 *
 * Without it, two resumes on one screen — the template gallery renders a dozen — would
 * fight over the same `[data-resume-prose]` rules and every thumbnail would take the last
 * one's accent and spacing. Derived, not random, because a hook-free tree has no `useId`
 * and the server and client renders have to agree.
 */
function proseScope(template: ResolvedTemplate): string {
  const parts = [
    template.definition.id,
    template.colors.id,
    template.colors.accent,
    // Two resumes on the same template can still differ in type size and rhythm.
    Math.round(template.type.bodyPx * 100),
    Math.round(template.spacing.blockGapPx * 100),
  ];

  // This value goes into a CSS selector, so it is reduced to a character class that
  // cannot terminate one. Every input is registry- or schema-controlled today; the
  // filter is what keeps that from being load-bearing.
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

/** Rounded, and never `NaN` — an invalid length would invalidate the whole declaration. */
function px(value: number): string {
  return `${Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}px`;
}

function proseStyles(template: ResolvedTemplate, scope: string): string {
  const { colors, spacing, definition } = template;
  const root = `[data-resume-scope="${scope}"] [data-resume-prose]`;
  const bullet = definition.tokens.bullet === "dash" ? "–" : "•";

  // Matches `Bullets` in `resume-atoms.tsx` deliberately: a highlight typed into the
  // rich-text editor and one typed into the bullet list must look identical, because the
  // reader has no idea which field produced which line.
  return [
    `${root}{display:flex;flex-direction:column;gap:${px(spacing.blockGapPx)}}`,
    `${root} p{margin:0}`,
    `${root} strong{font-weight:600}`,
    `${root} em{font-style:italic}`,
    `${root} a{color:${colors.accent};text-decoration:none}`,
    `${root} ul{display:flex;flex-direction:column;gap:${px(spacing.blockGapPx / 2)};list-style:none;margin:0;padding:0}`,
    `${root} li{display:flex;gap:${px(spacing.blockGapPx * 1.5)}}`,
    `${root} li::before{content:"${bullet}";color:${colors.accent};flex:none}`,
    // TipTap's `ListItem` takes block content, so a bullet round-trips as
    // `<li><p>…</p></li>`. Without this the paragraph reset above is not enough to stop
    // the browser's default list spacing from reappearing inside the flex row.
    `${root} li>p{margin:0;flex:1}`,
  ].join("");
}
