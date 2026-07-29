/**
 * A wide column of experience beside a narrow column of skills, on either side.
 *
 * `sidebar-left` and `sidebar-right` are one component with a `side` prop rather than two
 * near-identical files: they differ by which physical edge the narrow column is glued to,
 * and everything else — the split, the fill, the bleed, the full-height rule — is shared.
 *
 * Two things here are not obvious and both are deliberate:
 *
 * 1. **DOM order is always main-then-aside**, and a left sidebar is painted left with
 *    `row-reverse`. A PDF's text layer follows the DOM, so an ATS reading a page whose
 *    first text is "Skills" scores the name as missing. Paint order is cosmetic; reading
 *    order is not.
 * 2. **The fill bleeds through the page margin.** The page's padding lives on the
 *    `<article>`, so the only way for a coloured column to reach the paper's edge is a
 *    negative margin of exactly that padding, with the same value added back as padding so
 *    the text inside still sits on the margin line.
 */

import type { CSSProperties } from "react";

import { ResumeHeader } from "../components/resume-header";
import { asideRegion } from "../lib/regions";
import { partitionAsideSections } from "../lib/section-columns";
import { asideWidthPct, SectionStack, type LayoutProps } from "./layout-shared";

export interface SidebarLayoutProps extends LayoutProps {
  side: "left" | "right";
}

export function SidebarLayout({ template, document, side }: SidebarLayoutProps) {
  const { main, aside } = partitionAsideSections(document.sections);
  const { spacing, page } = template;

  const header = (
    <ResumeHeader
      template={template}
      basics={document.basics}
      align={template.definition.tokens.headerAlign}
    />
  );

  // `partitionAsideSections` collapses to a single column when either side would be empty,
  // so this is the resume that is all experience or all skills. Rendering the row anyway
  // would put a third of the page under an empty tinted stripe.
  if (aside.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.sectionGapPx }}>
        {header}
        <SectionStack template={template} sections={main} />
      </div>
    );
  }

  const region = asideRegion(template);
  const bleed = region.background === null ? 0 : page.marginPx;
  const gutter = spacing.sectionGapPx * 1.25;
  /** Between the fill's inner edge and its text. The gutter alone would look like a leak. */
  const innerPad = bleed === 0 ? 0 : gutter * 0.6;

  const asideStyle: CSSProperties = {
    boxSizing: "border-box",
    flex: "0 0 auto",
    // The bleed widens the box, so the width has to grow with it for the *content* to stay
    // at the requested percentage of the content box.
    width:
      bleed === 0
        ? `${asideWidthPct(template)}%`
        : `calc(${asideWidthPct(template)}% + ${bleed}px)`,
    display: "flex",
    flexDirection: "column",
    gap: region.template.spacing.sectionGapPx,
    backgroundColor: region.background ?? undefined,
    color: region.template.colors.body,
    marginTop: -bleed,
    marginBottom: -bleed,
    marginLeft: side === "left" ? -bleed : 0,
    marginRight: side === "right" ? -bleed : 0,
    paddingTop: bleed,
    paddingBottom: bleed,
    paddingLeft: side === "left" ? bleed : innerPad,
    paddingRight: side === "right" ? bleed : innerPad,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: side === "left" ? "row-reverse" : "row",
        alignItems: "stretch",
        gap: gutter,
        // A one-page resume with three skills must still show a full-height sidebar; without
        // this the fill stops where its content does and reads as a rendering bug. Only when
        // filled — an unfilled aside has nothing to stretch.
        ...(bleed === 0 ? {} : { minHeight: page.heightPx - page.marginPx * 2 }),
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          // Without `minWidth: 0` a long unbroken URL in a bullet pushes the flex item past
          // its basis and squeezes the sidebar to nothing.
          minWidth: 0,
          flex: "1 1 0",
          gap: spacing.sectionGapPx,
        }}
      >
        {header}
        <SectionStack template={template} sections={main} />
      </div>
      <div style={asideStyle}>
        <SectionStack template={region.template} sections={aside} />
      </div>
    </div>
  );
}
