/**
 * Runs the rich-text sanitizer over every field of a document that holds HTML.
 *
 * The editor's ProseMirror schema already refuses anything outside the allowlist,
 * but the save action receives JSON over the network — the browser is a suggestion,
 * and `resumeDocumentSchema` bounds these fields' length without looking inside
 * them. This is the boundary where the HTML stops being untrusted, so it runs on
 * the parsed document immediately before the row is written, and its output is
 * what the editor reloads, the templates render, Puppeteer prints, and the public
 * `/r/[slug]` page serves.
 *
 * The switch is exhaustive on `kind` on purpose: a new section carrying prose is a
 * type error here until someone decides whether that prose needs sanitizing.
 */

import type { ResumeDocument, ResumeSection } from "@/types/resume";
import { sanitizeRichText } from "@/utils/sanitize-rich-text";

/** The seven item kinds whose prose field is called `summary`. */
function sanitizeSummaries<TItem extends { summary: string }>(items: TItem[]): TItem[] {
  return items.map((item) => ({ ...item, summary: sanitizeRichText(item.summary) }));
}

/** …and the two whose prose field is called `description`. */
function sanitizeDescriptions<TItem extends { description: string }>(items: TItem[]): TItem[] {
  return items.map((item) => ({ ...item, description: sanitizeRichText(item.description) }));
}

function sanitizeSection(section: ResumeSection): ResumeSection {
  switch (section.kind) {
    case "summary":
      return { ...section, content: sanitizeRichText(section.content) };
    case "experience":
      return { ...section, items: sanitizeSummaries(section.items) };
    case "education":
      return { ...section, items: sanitizeSummaries(section.items) };
    case "awards":
      return { ...section, items: sanitizeSummaries(section.items) };
    case "publications":
      return { ...section, items: sanitizeSummaries(section.items) };
    case "references":
      return { ...section, items: sanitizeSummaries(section.items) };
    case "projects":
      return { ...section, items: sanitizeDescriptions(section.items) };
    case "custom":
      return { ...section, items: sanitizeDescriptions(section.items) };
    // Plain text throughout: skills, languages, certifications, and interests are
    // names, levels, dates, and URLs, all bounded and typed by the schema. Nothing
    // here is ever rendered as HTML.
    case "skills":
    case "languages":
    case "certifications":
    case "interests":
      return section;
  }
}

export function sanitizeResumeDocument(document: ResumeDocument): ResumeDocument {
  return { ...document, sections: document.sections.map(sanitizeSection) };
}
