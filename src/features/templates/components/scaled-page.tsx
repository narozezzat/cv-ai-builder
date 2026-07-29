"use client";

/**
 * Shrinks a rendered page to the width it is given.
 *
 * A resume page is a fixed 794px of paper, and every surface that shows one — the
 * editor's preview, a gallery thumbnail, the design panel's swatch — needs it at a
 * different size. `transform: scale()` is the only way to do that without the template
 * knowing: it scales the type, the rules, and the spacing together, where a CSS-width
 * change would reflow the layout into something the PDF would not match.
 *
 * Why this is a client component when its children are server-rendered: `scale()` needs
 * a number, and the number is the container's measured width. `children` crosses the
 * boundary as already-rendered output, so the document itself never gets serialised into
 * the flight payload — twenty thumbnails cost twenty scale factors, not twenty resumes.
 *
 * `initialWidth` is what the server renders at. Without it the first paint would be a
 * full-size page cropped to a thumbnail-sized window, and the correction after hydration
 * would be a visible jump; with it the observer usually confirms what is already on
 * screen. That also makes the component degrade to a sensible size with JS disabled.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Never upscale: a 794px page blown up to fill a wide card reads as a zoom bug. */
const MAX_SCALE = 1;

export interface ScaledPageProps {
  /** Natural page width in CSS pixels, from `resolveTemplate`. */
  width: number;
  /**
   * Visible height in natural pixels, before scaling. A thumbnail passes one page height
   * and clips: the first page is the preview, and a two-page fixture must not stretch
   * the card it sits in.
   */
  height: number;
  /** Width the server renders at, before the container has been measured. */
  initialWidth: number;
  className?: string;
  children: ReactNode;
}

export function ScaledPage({ width, height, initialWidth, className, children }: ScaledPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState(initialWidth);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    // `ResizeObserver` rather than a window `resize` listener: the card also changes width
    // when the layout around it changes — a sidebar opening, a filter row wrapping — and
    // none of those fire `resize`.
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const box = entry.borderBoxSize?.[0];

        setMeasuredWidth(box?.inlineSize ?? entry.contentRect.width);
      }
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const scale = Math.min(MAX_SCALE, measuredWidth / width);

  return (
    <div ref={containerRef} className={cn("w-full overflow-hidden", className)}>
      {/* Two wrappers, because `transform` does not affect layout: the outer one reserves
          the scaled height, the inner one does the scaling. Without the outer box the
          page would either be clipped or leave a gap the size of the unscaled document. */}
      <div style={{ height: height * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width }}>
          <div style={{ height, overflow: "hidden" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
