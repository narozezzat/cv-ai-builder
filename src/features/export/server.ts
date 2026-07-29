/**
 * The server half of the export feature's public surface.
 *
 * Split from `index.ts` for the same reason the template feature splits its own: everything
 * here reaches an `import "server-only"` module, and a barrel is one webpack module — a
 * single server-only import in `index.ts` would fail the client build for every component
 * that imports the dialog.
 *
 * Only `app` may import this file, and only from a Server Component. Today that is the print
 * route, which is the one consumer that needs to verify a token and read a resume without a
 * session.
 */

export {
  PRINT_TOKEN_TTL_SECONDS,
  verifyPrintToken,
  type PrintTokenFailure,
  type PrintTokenPayload,
  type PrintTokenResult,
} from "./lib/print-token";
export {
  getPrintableResume,
  type PrintableResume,
  type PrintableResumeFailure,
  type PrintableResumeResult,
} from "./queries/print-queries";
