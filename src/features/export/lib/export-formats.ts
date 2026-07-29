/**
 * The catalogue of things a resume can be turned into.
 *
 * Client-safe on purpose — the dialog reads the labels, the server action reads the mime
 * type and the extension, and both need to agree. Nothing here imports `server-only`, so
 * this module is importable from the barrel.
 *
 * The format list is not declared here — it is the `export_format` database enum, re-exported
 * from `types/db` where it is asserted exhaustive against the generated types. Adding a
 * fourth format is a migration plus a definition below, and leaving the definition out is a
 * type error on the `Record` rather than a runtime `undefined.extension`.
 */

import { EXPORT_FORMATS, type ExportFormat } from "@/types/db";

export { EXPORT_FORMATS, type ExportFormat };

export interface ExportFormatDefinition {
  id: ExportFormat;
  label: string;
  /** One line, shown under the label in the dialog. Says what the file is *for*. */
  description: string;
  /** No leading dot. */
  extension: string;
  /** Sent to Supabase Storage as `contentType` and used for the `Content-Type` header. */
  mimeType: string;
}

export const EXPORT_FORMAT_DEFINITIONS: Record<ExportFormat, ExportFormatDefinition> = {
  pdf: {
    id: "pdf",
    label: "PDF",
    // Selectable text is the point, not a detail: an ATS that cannot read the text
    // scores a resume as empty, which is the single most expensive failure here.
    description: "Vector, selectable text, real page breaks. What you send to employers.",
    extension: "pdf",
    mimeType: "application/pdf",
  },
  png: {
    id: "png",
    label: "PNG",
    description: "Lossless image of page one. For portfolios and LinkedIn posts.",
    extension: "png",
    mimeType: "image/png",
  },
  jpeg: {
    id: "jpeg",
    label: "JPEG",
    description: "Smaller image of page one, for uploads with a size cap.",
    extension: "jpg",
    mimeType: "image/jpeg",
  },
};

export const EXPORT_FORMAT_ORDER: readonly ExportFormat[] = EXPORT_FORMATS;

/**
 * Pixel density for the image formats.
 *
 * A CSS inch is 96px, so these land at roughly 190 and 290 DPI — the second is print
 * resolution, which is why it exists at all. PDF ignores the setting entirely: it is
 * vector output, and rasterising it to "high quality" would only make a bigger file
 * whose text stopped being text.
 */
export const IMAGE_SCALES = [2, 3] as const;

export type ImageScale = (typeof IMAGE_SCALES)[number];

export const IMAGE_SCALE_LABELS: Record<ImageScale, string> = {
  2: "Standard — 2×, about 190 DPI",
  3: "High — 3×, about 290 DPI",
};

export const DEFAULT_IMAGE_SCALE: ImageScale = 2;

/** False for PDF, where the control would be a lie. The dialog hides it rather than disabling it. */
export function supportsImageScale(format: ExportFormat): boolean {
  return format !== "pdf";
}

/** JPEG only. Below ~0.9 the accent rules and small type start to fringe. */
export const JPEG_QUALITY = 0.92;
