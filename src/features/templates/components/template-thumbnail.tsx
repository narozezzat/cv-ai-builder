/**
 * A template's first page, at card size.
 *
 * The thumbnail is the real thing: `ResumeRenderer` with the sample document, the same
 * component the editor's preview and the print route render. Twenty hand-drawn
 * placeholders would be twenty pictures to re-draw whenever a layout changed, and the
 * first one to go stale would be a template the user picks and then does not recognise.
 *
 * `aria-hidden`, and deliberately so: this is a picture of a layout, not content. Left
 * exposed, a screen reader would read Amara Osei's entire fictional career twenty times
 * over on one page, burying the template names that are the only thing worth hearing.
 * The card supplies the accessible name.
 */

import { cn } from "@/lib/utils";

import { sampleResumeInput } from "../lib/sample-document";
import { resolveTemplate } from "../lib/resolve-template";

import { ResumeRenderer } from "./resume-renderer";
import { ScaledPage } from "./scaled-page";

/**
 * The width the grid's cards settle at on a desktop viewport, and so the width the server
 * renders the thumbnail at before `ScaledPage` measures the real one.
 */
const THUMBNAIL_WIDTH = 320;

/**
 * How much of the page a card shows.
 *
 * A full A4 page at card width is 450px tall, which pushes the template's name below the
 * fold of a three-up grid. Two thirds is enough to read the header treatment, the first
 * section, and the column structure — which is what distinguishes one template from
 * another — and the fade at the bottom says "continues" rather than "ends here".
 */
const VISIBLE_PAGE_FRACTION = 0.66;

export interface TemplateThumbnailProps {
  templateId: string;
  /** Palette to preview. Defaults to the template's own first palette. */
  paletteId?: string;
  className?: string;
}

export function TemplateThumbnail({ templateId, paletteId, className }: TemplateThumbnailProps) {
  const input = sampleResumeInput(templateId, { paletteId });
  const template = resolveTemplate({
    templateId,
    theme: input.theme,
    page: input.page,
  });

  return (
    <div aria-hidden className={cn("relative bg-white", className)}>
      <ScaledPage
        width={template.page.widthPx}
        height={template.page.heightPx * VISIBLE_PAGE_FRACTION}
        initialWidth={THUMBNAIL_WIDTH}
      >
        <ResumeRenderer {...input} />
      </ScaledPage>

      {/* Fade over the cut edge. Absolute rather than a gradient on the page itself: the
          page is the renderer's output and must stay byte-identical to what prints. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-b from-transparent to-white" />
    </div>
  );
}
