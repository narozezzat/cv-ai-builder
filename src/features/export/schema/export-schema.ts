/**
 * Input contract for the one write the export feature owns.
 *
 * `resumeId` is validated as a uuid before it reaches a query: a malformed id would come
 * back from Postgres as a 22P02 rather than "not found", and the difference between those
 * two errors is a way to ask whether an id exists. The format and scale are closed sets —
 * `format` because it is a database enum, `scale` because it becomes a `deviceScaleFactor`
 * and an unbounded number there is a request to allocate an arbitrarily large bitmap.
 */

import { z } from "zod";

import { DEFAULT_IMAGE_SCALE, EXPORT_FORMATS, IMAGE_SCALES } from "../lib/export-formats";

export const exportFormatSchema = z.enum(EXPORT_FORMATS);

/**
 * `z.literal` over the tuple rather than `z.number().min(2).max(3)`: the renderer
 * multiplies the page box by this, so 2.9999 is a valid number and a pointless bitmap.
 */
export const imageScaleSchema = z.union([z.literal(IMAGE_SCALES[0]), z.literal(IMAGE_SCALES[1])]);

export const exportResumeSchema = z.object({
  resumeId: z.uuid("That resume could not be found."),
  format: exportFormatSchema,
  /**
   * Ignored for PDF, which is vector output. Defaulted rather than required so the dialog
   * can omit it entirely when it hides the control.
   */
  scale: imageScaleSchema.default(DEFAULT_IMAGE_SCALE),
});

export type ExportResumeInput = z.infer<typeof exportResumeSchema>;
