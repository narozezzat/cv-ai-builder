/**
 * A full-bleed band behind the name, then a single column beneath it.
 *
 * The band reaches three edges of the paper, which means escaping the page margin: that
 * padding is on the `<article>`, so the band takes a negative margin of exactly it and adds
 * the same value back as padding. Getting those two out of step is visible as text sitting
 * off the margin line every other block sits on.
 *
 * Inside the band the palette is not the page's — see `regions.ts`. The header renders with
 * the region's template so `heading`, `body`, and links are the inverted ink, and the
 * contrast floors are asserted for every palette in `regions.test.ts` rather than eyeballed
 * on the one palette the template ships as default.
 */

import { ResumeHeader } from "../components/resume-header";
import { isSectionRendered } from "../components/resume-sections";
import { bannerRegion } from "../lib/regions";
import { SectionStack, type LayoutProps } from "./layout-shared";

export function HeaderBannerLayout({ template, document }: LayoutProps) {
  const sections = document.sections.filter(isSectionRendered);
  const region = bannerRegion(template);
  const margin = template.page.marginPx;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: template.spacing.sectionGapPx }}>
      <div
        style={{
          marginTop: -margin,
          marginLeft: -margin,
          marginRight: -margin,
          // Slightly shallower below than above: the section gap adds to the bottom, and an
          // even padding reads as bottom-heavy once it does.
          padding: `${margin}px ${margin}px ${margin * 0.8}px`,
          backgroundColor: region.background ?? undefined,
          color: region.template.colors.body,
          // A band split across a page break would paint a stripe at the top of page two.
          breakInside: "avoid",
        }}
      >
        <ResumeHeader
          template={region.template}
          basics={document.basics}
          align={template.definition.tokens.headerAlign}
        />
      </div>
      <SectionStack template={template} sections={sections} />
    </div>
  );
}
