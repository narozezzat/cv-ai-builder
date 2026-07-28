"use client";

/**
 * The live preview pane.
 *
 * It renders `<ResumeRenderer>` — the same component the print route and the public
 * share page render — so preview and PDF cannot drift apart. Everything specific to
 * *previewing* is in this file and nowhere in the template tree: the scaling, the
 * measurement, the paper drop shadow.
 *
 * Two measurements, both with `ResizeObserver` rather than a window `resize` listener,
 * because the pane also changes size when the layout around it changes (sidebar,
 * accordion, viewport rotation):
 *
 * - the **pane's width**, which sets the scale factor;
 * - the **rendered page's height**, because a two-page resume is taller than
 *   `page.heightPx` and `transform: scale()` does not affect layout — without the
 *   second measurement the scaled page would either be clipped or leave a gap the
 *   size of the unscaled document.
 *
 * The store is subscribed to directly instead of taking props: the editor's fields
 * write to the same store, so a keystroke reaches this component without the editor
 * having to thread anything through, and only the slices that changed re-render.
 */

import { useEffect, useRef, useState } from "react";

import { ResumeRenderer, resolveTemplate } from "@/features/templates";
import { cn } from "@/lib/utils";

import {
  selectDocument,
  selectPage,
  selectTemplateId,
  selectTheme,
  useResumeStore,
} from "../../store/resume-store";

/** Never upscale. A 794px page blown up to fill a wide monitor reads as a zoom bug. */
const MAX_SCALE = 1;

export interface ResumePreviewProps {
  className?: string;
}

export function ResumePreview({ className }: ResumePreviewProps) {
  const resumeId = useResumeStore((state) => state.resumeId);
  const resumeDocument = useResumeStore(selectDocument);
  const theme = useResumeStore(selectTheme);
  const page = useResumeStore(selectPage);
  const templateId = useResumeStore(selectTemplateId);

  const paneRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [paneWidth, setPaneWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);

  useEffect(() => {
    const pane = paneRef.current;
    const paper = pageRef.current;

    if (!pane || !paper) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // `borderBoxSize` over `contentRect`: the page's box includes its own padding,
        // and the pane's excludes it — reading the border box makes both mean the same
        // thing. `contentRect` is the fallback for Safari < 15.4.
        const box = entry.borderBoxSize?.[0];

        if (entry.target === pane) {
          setPaneWidth(box?.inlineSize ?? entry.contentRect.width);
        } else {
          setPageHeight(box?.blockSize ?? entry.contentRect.height);
        }
      }
    });

    observer.observe(pane);
    observer.observe(paper);

    return () => observer.disconnect();
  }, []);

  const template = resolveTemplate({ templateId, theme, page });
  const measured = paneWidth > 0;
  const scale = measured ? Math.min(MAX_SCALE, paneWidth / template.page.widthPx) : MAX_SCALE;
  const height = (pageHeight || template.page.heightPx) * scale;

  return (
    <div
      ref={paneRef}
      // `overflow-hidden` on the pane, not the page: at the narrowest breakpoint the
      // page is scaled to fit, so nothing should ever scroll sideways here.
      className={cn("w-full overflow-hidden", className)}
      // Labelled as a region rather than hidden from assistive tech: the editor's
      // fields describe what you are typing, this describes what comes out.
      role="region"
      aria-label="Resume preview"
      // Announced only on load. Every keystroke changes this subtree, and a live
      // region over the whole document would read the resume back continuously.
      aria-busy={!measured || resumeId === null}
    >
      <div style={{ height }}>
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: template.page.widthPx,
            // Hidden rather than unmounted until the first measurement: the page has
            // to be in the DOM to be measured, and one frame at full size is a
            // visible jump.
            opacity: measured ? 1 : 0,
          }}
        >
          <div
            ref={pageRef}
            className="overflow-hidden rounded-sm shadow-lg ring-1 ring-black/10"
            // `isolate`-free on purpose: a stacking context here would trap the
            // page's own shadow. The ring is the paper edge on a light background.
          >
            <ResumeRenderer
              document={resumeDocument}
              theme={theme}
              page={page}
              templateId={templateId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
