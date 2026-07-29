/**
 * The page headless Chromium screenshots.
 *
 * Deliberately outside every route group: no dashboard shell, no navigation, no builder
 * chrome. What Puppeteer loads is one `<article>` and the stylesheet the renderer carries
 * with it, because anything else in the tree is something that could end up in a PDF.
 *
 * SECURITY — this route is reachable without a session, and that is not an oversight:
 * Chromium navigates with an empty profile and no cookies, so there is no session for it to
 * carry and `/print` is deliberately absent from `PROTECTED_PREFIXES`. Authorization comes
 * from the signed token in the URL instead. Three consequences worth naming:
 *
 * 1. The user id used for the read comes from the *verified* token payload, never from a
 *    query parameter. `verifyPrintToken` returning `ok: false` ends the request.
 * 2. Every failure — forged, expired, malformed, wrong owner, trashed, unparseable — answers
 *    with the same 404. Distinguishing them would turn this into an oracle for which resume
 *    ids exist and which half of a token to keep guessing at.
 * 3. `noindex, nofollow`, and the token expires in two minutes, so a URL that leaks into a
 *    log or a referrer header is worthless by the time anyone reads it.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import {
  getPrintableResume,
  verifyPrintToken,
  type PrintableResume,
} from "@/features/export/server";
import { ResumeRenderer } from "@/features/templates";

interface PrintPageProps {
  params: Promise<{ token: string }>;
}

/**
 * A token is single-use in practice and expires in two minutes, so there is nothing here
 * worth caching and a cached render would be a resume served to the next request.
 */
export const dynamic = "force-dynamic";

/**
 * One load per request, shared by `generateMetadata` and the page.
 *
 * `cache` is what keeps the document title from costing a second token verification and a
 * second database read — Next calls both functions for the same request.
 */
const loadPrintable = cache(async (token: string): Promise<PrintableResume | null> => {
  let payload;

  try {
    const verified = verifyPrintToken(token);

    if (!verified.ok) {
      // Logged with the reason so operations can tell a misconfiguration from a probe. The
      // response says nothing.
      console.warn("[export] print token rejected", { reason: verified.reason });

      return null;
    }

    payload = verified.payload;
  } catch (cause) {
    // `verifyPrintToken` throws when `EXPORT_TOKEN_SECRET` is unset. A 500 would advertise
    // that the deployment is half-configured; a 404 is the same answer every other failure
    // gets.
    console.error("[export] print token could not be verified", cause);

    return null;
  }

  const result = await getPrintableResume({
    resumeId: payload.resumeId,
    userId: payload.userId,
  });

  if (!result.ok) {
    console.warn("[export] print load rejected", { reason: result.reason });

    return null;
  }

  return result.resume;
});

export async function generateMetadata({ params }: PrintPageProps): Promise<Metadata> {
  const { token } = await params;
  const resume = await loadPrintable(token);

  return {
    // Chromium writes the document title into the PDF's Title property, which is what a
    // viewer shows in its tab and title bar. React escapes it; it is never markup.
    title: resume?.title ?? "Resume",
    // Belt to the token's braces. A print URL should never be crawled even in the seconds
    // it is live.
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function PrintPage({ params }: PrintPageProps) {
  const { token } = await params;
  const resume = await loadPrintable(token);

  if (!resume) {
    notFound();
  }

  return (
    <main
      id="main"
      style={{
        // The sheet, and nothing else. `colorScheme: "light"` pins the rendering even if the
        // theme class lands on <html> — a resume is printed on white paper regardless of what
        // the app's theme was, and a dark backdrop would print as a grey border.
        colorScheme: "light",
        backgroundColor: "#ffffff",
        display: "flex",
        margin: 0,
        padding: 0,
      }}
    >
      <ResumeRenderer
        printTarget
        templateId={resume.templateId}
        document={resume.document}
        theme={resume.theme}
        page={resume.page}
      />
    </main>
  );
}
