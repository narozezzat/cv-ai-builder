/**
 * The client-safe half of the export feature's public surface.
 *
 * A barrel is a module, not a menu: one server-only import anywhere in it fails the client
 * build for all of them. So everything that verifies a token or reads a resume without a
 * session lives in `./server`, and only `app` Server Components may import that. What is
 * left here is safe in a `"use client"` tree — a server *action* is, because it compiles to
 * an RPC reference rather than the function body.
 *
 * Nothing added below may reach `lib/print-token`, `queries/`, or `services/render`.
 */

export { ExportDialog, type ExportDialogProps } from "./components/export-dialog";
export { exportResume, type ExportResumeResult } from "./actions/export-resume";
export {
  DEFAULT_IMAGE_SCALE,
  EXPORT_FORMAT_DEFINITIONS,
  EXPORT_FORMAT_ORDER,
  EXPORT_FORMATS,
  IMAGE_SCALES,
  IMAGE_SCALE_LABELS,
  supportsImageScale,
  type ExportFormat,
  type ExportFormatDefinition,
  type ImageScale,
} from "./lib/export-formats";
export { exportResumeSchema, type ExportResumeInput } from "./schema/export-schema";
