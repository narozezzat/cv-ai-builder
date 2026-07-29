import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ButtonLink, StatusPage } from "@/components/shared";
import { ResumeEditor, getResumeForEditor } from "@/features/resume";
import { routes } from "@/lib/routes";

/**
 * `noindex` for the same reason as the dashboard: this URL is only reachable with a
 * session, so a crawler that found it would index a login redirect.
 */
export const metadata: Metadata = {
  title: "Editor",
  robots: { index: false, follow: false },
};

/**
 * The export action is invoked from this route, so it runs inside this route's function —
 * and it launches Chromium, loads `/print/[token]`, waits on webfonts, and uploads the
 * result. The platform default of 10 or 15 seconds kills that mid-render on a cold start,
 * which the user experiences as "downloads never work the first time".
 *
 * A ceiling, not a target: nothing here waits 60 seconds on purpose, and the renderer sets
 * its own shorter timeouts so a hung page fails as a `failed` export row rather than a
 * function that runs to the wall.
 */
export const maxDuration = 60;

/**
 * The three failure modes are three different screens, deliberately.
 *
 * `not-found` covers both "no such resume" and "not yours" — RLS makes them
 * indistinguishable here, which is correct, since confirming a resume exists would
 * leak its id to whoever guessed it. `trashed` and `unreadable` are recoverable and
 * say how, because a 404 for either would look like the resume was destroyed.
 */
export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getResumeForEditor(id);

  if (!result.ok) {
    if (result.reason === "not-found") {
      notFound();
    }

    if (result.reason === "trashed") {
      return (
        <StatusPage
          code="Trash"
          title="This resume is in the trash"
          description="Nothing is lost — restore it from the trash and it opens straight back up, with its version history intact."
          actions={
            <>
              <ButtonLink href={routes.trash} size="lg">
                Open trash
              </ButtonLink>
              <ButtonLink href={routes.resumes} variant="outline" size="lg">
                Back to resumes
              </ButtonLink>
            </>
          }
        />
      );
    }

    return (
      <StatusPage
        code="Stop"
        title="We would not open this one safely"
        description="The stored document does not match the shape the editor expects, so opening it would risk overwriting your content with a blank one. The resume itself is untouched — restore an earlier version from its history, or duplicate it and edit the copy."
        actions={
          <>
            <ButtonLink href={routes.resumes} size="lg">
              Back to resumes
            </ButtonLink>
          </>
        }
      />
    );
  }

  const { resume } = result;

  return (
    <ResumeEditor
      resumeId={resume.id}
      title={resume.title}
      document={resume.document}
      theme={resume.theme}
      page={resume.page}
      templateId={resume.templateId}
      savedAt={resume.updatedAt}
    />
  );
}
