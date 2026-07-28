/**
 * Coverage tests, not sanitizer tests — `sanitize-rich-text.test.ts` owns the attack
 * cases. What matters here is that no rich-text field is missed: a field the walk
 * skips is a stored-XSS hole on the public share page, and the only way to know the
 * walk is complete is to hand it a document with every section kind populated.
 */

import { describe, expect, it } from "vitest";

import {
  RESUME_SECTION_KINDS,
  createSection,
  createSectionItem,
  emptyResumeDocument,
  isItemSection,
  type ResumeDocument,
  type ResumeSection,
} from "@/types/resume";

import { sanitizeResumeDocument } from "./sanitize-document";

const HOSTILE = '<p onclick="steal()">Led <strong>work</strong><script>alert(1)</script></p>';
const CLEAN = "<p>Led <strong>work</strong></p>";

/** Every section kind, each with one item, every prose field carrying `HOSTILE`. */
function hostileDocument(): ResumeDocument {
  const sections = RESUME_SECTION_KINDS.map((kind): ResumeSection => {
    const section = createSection(kind);

    if (!isItemSection(section)) {
      return { ...section, content: HOSTILE };
    }

    // Only fields the item shape actually has: writing `description` onto a skills
    // item would test a key the schema strips, not the walk.
    const item = createSectionItem(section.kind);
    const prose = {
      ...("summary" in item ? { summary: HOSTILE } : {}),
      ...("description" in item ? { description: HOSTILE } : {}),
    };

    return { ...section, items: [{ ...item, ...prose }] } as ResumeSection;
  });

  return { ...emptyResumeDocument(), sections };
}

/** Every string in the document that still contains markup or a handler. */
function proseValues(document: ResumeDocument): string[] {
  return document.sections.flatMap((section) =>
    isItemSection(section)
      ? section.items.flatMap((item) =>
          Object.values(item).filter((value): value is string => typeof value === "string"),
        )
      : [section.content],
  );
}

describe("sanitizeResumeDocument", () => {
  it("sanitizes the prose field of every section kind that has one", () => {
    const hostile = hostileDocument();
    // Guard the fixture itself: if a future section stops seeding prose, the sweep
    // below would pass by having nothing to check.
    const seeded = proseValues(hostile).filter((value) => value === HOSTILE).length;

    expect(seeded).toBe(8);

    const sanitized = sanitizeResumeDocument(hostile);

    // Per kind rather than one flat sweep, so a miss names the section it is in.
    for (const section of sanitized.sections) {
      const stored = isItemSection(section)
        ? ((section.items[0] as Record<string, unknown>).summary ??
          (section.items[0] as Record<string, unknown>).description)
        : section.content;

      // Plain-text kinds have no prose field at all; that is the point of the walk
      // returning them untouched.
      if (typeof stored !== "string" || stored.length === 0) continue;

      expect(stored, section.kind).toBe(CLEAN);
    }
  });

  it("leaves no script or handler anywhere in the document", () => {
    const sanitized = sanitizeResumeDocument(hostileDocument());

    for (const value of proseValues(sanitized)) {
      expect(value).not.toContain("<script");
      expect(value).not.toContain("onclick");
    }
  });

  it("does not mutate the document it is given", () => {
    const document = hostileDocument();
    const before = JSON.stringify(document);

    sanitizeResumeDocument(document);

    // The store holds this object. Mutating it in place would leave the editor
    // showing sanitized HTML it never round-tripped, and undo would step over it.
    expect(JSON.stringify(document)).toBe(before);
  });

  it("is idempotent, so a save of an already-stored document is a no-op", () => {
    const once = sanitizeResumeDocument(hostileDocument());

    expect(sanitizeResumeDocument(once)).toEqual(once);
  });

  it("never lengthens a field, so it cannot push a value past its Zod bound", () => {
    const document = hostileDocument();
    const lengths = proseValues(document).map((value) => value.length);

    proseValues(sanitizeResumeDocument(document)).forEach((value, index) => {
      expect(value.length).toBeLessThanOrEqual(lengths[index]);
    });
  });

  it("leaves an untouched document exactly as it was", () => {
    const document = emptyResumeDocument();

    expect(sanitizeResumeDocument(document)).toEqual(document);
  });
});
