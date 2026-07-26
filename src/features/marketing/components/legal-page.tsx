import { FadeUp } from "@/components/shared";

import type { LegalDocument } from "../legal-content";

/**
 * Renderer for the legal documents.
 *
 * One component for both, because a Terms page and a Privacy page that differ in
 * type scale or spacing look like one of them was an afterthought. The prose styles
 * are written out here rather than pulled from a typography plugin — two documents
 * do not justify the dependency, and the measure is deliberately narrower than the
 * marketing container so a paragraph stays readable.
 *
 * Content is plain text from `legal-content.ts`, never user input, so there is no
 * HTML to sanitize and nothing to hydrate: this stays a Server Component.
 */
export function LegalPage({ document }: { document: LegalDocument }) {
  const updated = new Date(`${document.updated}T00:00:00Z`);

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <FadeUp className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold sm:text-4xl">{document.title}</h1>
        <p className="text-sm text-muted-foreground">
          Last updated{" "}
          <time dateTime={document.updated}>
            {updated.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })}
          </time>
        </p>
        {/* The summary is the part most people will read. Given visual weight for
            that reason, rather than buried under ten numbered headings. */}
        <p className="rounded-xl border border-border/60 bg-muted/40 p-4 text-sm leading-relaxed text-foreground/90">
          {document.summary}
        </p>
      </FadeUp>

      <div className="mt-12 flex flex-col gap-10">
        {document.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>

            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}

            {section.bullets ? (
              <ul className="flex flex-col gap-2 pl-1">
                {section.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex gap-3 text-sm leading-relaxed text-muted-foreground"
                  >
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand/70" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}
