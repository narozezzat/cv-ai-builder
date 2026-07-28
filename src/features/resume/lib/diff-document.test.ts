/**
 * The diff is what the user reads before clicking "Restore", so a wrong entry here is
 * a user overwriting work they were told they were keeping. These tests pin the three
 * claims the dialog makes on its behalf: identity comes from ids (so a reorder is not
 * a change), a whole added or removed row is one entry rather than one per field, and
 * formatting-only rich-text edits are invisible.
 *
 * `isSameDocument` is a write guard, not a display concern — it decides whether a
 * snapshot is worth storing, so it gets its own cases including the key-order one that
 * `JSON.stringify` would get wrong.
 */

import { describe, expect, it } from "vitest";

import {
  type ExperienceItem,
  type ResumeDocument,
  type ResumeSectionOf,
  createSection,
  createSectionItem,
  emptyResumeDocument,
} from "@/types/resume";

import { type DiffEntry, diffResumeDocuments, isSameDocument } from "./diff-document";

function experienceSection(...items: ExperienceItem[]): ResumeSectionOf<"experience"> {
  return { ...createSection("experience"), id: "sec-experience", items };
}

function experience(id: string, patch: Partial<ExperienceItem> = {}): ExperienceItem {
  return { ...createSectionItem("experience"), id, ...patch };
}

function document(patch: Partial<ResumeDocument> = {}): ResumeDocument {
  return { ...emptyResumeDocument(), ...patch };
}

function withBasics(patch: Partial<ResumeDocument["basics"]>): ResumeDocument {
  const base = emptyResumeDocument();

  return { ...base, basics: { ...base.basics, ...patch } };
}

function find(entries: DiffEntry[], key: string): DiffEntry | undefined {
  return entries.find((entry) => entry.key === key);
}

describe("diffResumeDocuments", () => {
  it("reports nothing when both sides are the same document", () => {
    const diff = diffResumeDocuments(emptyResumeDocument(), emptyResumeDocument());

    expect(diff.entries).toEqual([]);
    expect(diff).toMatchObject({ added: 0, removed: 0, changed: 0 });
  });

  it("names the field, the group, and both sides of a changed value", () => {
    const diff = diffResumeDocuments(
      withBasics({ fullName: "Ada Lovelace" }),
      withBasics({ fullName: "Ada King" }),
    );

    expect(diff.changed).toBe(1);
    expect(find(diff.entries, "basics.fullName")).toMatchObject({
      group: "Basics",
      label: "Full name",
      kind: "changed",
      before: "Ada Lovelace",
      after: "Ada King",
    });
  });

  it("distinguishes filling a blank field from clearing a filled one", () => {
    const filled = diffResumeDocuments(withBasics({ email: "" }), withBasics({ email: "a@b.co" }));
    const cleared = diffResumeDocuments(withBasics({ email: "a@b.co" }), withBasics({ email: "" }));

    expect(find(filled.entries, "basics.email")).toMatchObject({ kind: "added", before: "" });
    expect(find(cleared.entries, "basics.email")).toMatchObject({ kind: "removed", after: "" });
    expect(filled).toMatchObject({ added: 1, removed: 0, changed: 0 });
    expect(cleared).toMatchObject({ added: 0, removed: 1, changed: 0 });
  });

  it("uses labels a reader recognizes rather than field names", () => {
    const before = document({ sections: [experienceSection(experience("item-1"))] });
    const after = document({
      sections: [
        experienceSection(experience("item-1", { startDate: "2021-03", url: "https://acme.test" })),
      ],
    });

    const labels = diffResumeDocuments(before, after).entries.map((entry) => entry.label);

    expect(labels).toContain("Start date");
    expect(labels).toContain("Link");
  });

  it("renders booleans and lists as text a person can read", () => {
    const before = document({ sections: [experienceSection(experience("item-1"))] });
    const after = document({
      sections: [
        experienceSection(
          experience("item-1", { current: true, highlights: ["Shipped v1", "Grew the team"] }),
        ),
      ],
    });

    const diff = diffResumeDocuments(before, after);

    expect(find(diff.entries, "item:item-1.current")).toMatchObject({
      kind: "changed",
      before: "No",
      after: "Yes",
    });
    expect(find(diff.entries, "item:item-1.highlights")?.after).toBe("Shipped v1 • Grew the team");
  });

  it("ignores a formatting-only rich-text edit", () => {
    const before = document({
      sections: [experienceSection(experience("item-1", { summary: "<p>Shipped fast</p>" }))],
    });
    const after = document({
      sections: [
        experienceSection(
          experience("item-1", { summary: "<p>Shipped <strong>fast</strong></p>" }),
        ),
      ],
    });

    expect(diffResumeDocuments(before, after).entries).toEqual([]);
  });

  it("reports a rich-text edit that changes the words, as prose", () => {
    const before = document({
      sections: [experienceSection(experience("item-1", { summary: "<p>Shipped fast</p>" }))],
    });
    const after = document({
      sections: [
        experienceSection(experience("item-1", { summary: "<p>Shipped <em>often</em></p>" })),
      ],
    });

    expect(find(diffResumeDocuments(before, after).entries, "item:item-1.summary")).toMatchObject({
      kind: "changed",
      before: "Shipped fast",
      after: "Shipped often",
    });
  });

  it("says nothing about a reorder, because rows are matched by id", () => {
    const first = experience("item-1", { company: "Acme" });
    const second = experience("item-2", { company: "Globex" });

    const diff = diffResumeDocuments(
      document({ sections: [experienceSection(first, second)] }),
      document({ sections: [experienceSection(second, first)] }),
    );

    expect(diff.entries).toEqual([]);
  });

  it("collapses an added item into one entry instead of one per field", () => {
    const diff = diffResumeDocuments(
      document({ sections: [experienceSection()] }),
      document({
        sections: [
          experienceSection(
            experience("item-1", {
              company: "Acme",
              position: "Engineer",
              startDate: "2021-03",
              summary: "<p>Built things</p>",
            }),
          ),
        ],
      }),
    );

    expect(diff.entries).toHaveLength(1);
    expect(diff.entries[0]).toMatchObject({
      key: "item:item-1",
      kind: "added",
      label: "Acme",
      after: "Acme",
    });
  });

  it("collapses a removed item the same way", () => {
    const diff = diffResumeDocuments(
      document({ sections: [experienceSection(experience("item-1", { company: "Acme" }))] }),
      document({ sections: [experienceSection()] }),
    );

    expect(diff.entries).toHaveLength(1);
    expect(diff.entries[0]).toMatchObject({ key: "item:item-1", kind: "removed", before: "Acme" });
  });

  it("collapses a whole added section, items included, into one entry per row", () => {
    const added = experienceSection(experience("item-1", { company: "Acme" }));
    const diff = diffResumeDocuments(document({ sections: [] }), document({ sections: [added] }));

    expect(diff.entries.map((entry) => entry.key)).toEqual([
      "section:sec-experience",
      "item:item-1",
    ]);
    expect(diff.added).toBe(2);
  });

  it("reports a renamed section once, not once for the rename and once for the row", () => {
    const section = experienceSection(experience("item-1", { company: "Acme" }));
    const diff = diffResumeDocuments(
      document({ sections: [section] }),
      document({ sections: [{ ...section, title: "Work history" }] }),
    );

    expect(diff.entries).toHaveLength(1);
    expect(diff.entries[0]).toMatchObject({
      key: "section:sec-experience.title",
      label: "Title",
      kind: "changed",
      after: "Work history",
    });
  });

  it("reports a renamed item once, under the section it belongs to", () => {
    const diff = diffResumeDocuments(
      document({ sections: [experienceSection(experience("item-1", { company: "Acme" }))] }),
      document({ sections: [experienceSection(experience("item-1", { company: "Globex" }))] }),
    );

    expect(diff.entries).toHaveLength(1);
    expect(diff.entries[0]).toMatchObject({
      key: "item:item-1.company",
      group: "Experience — Globex",
      kind: "changed",
      before: "Acme",
      after: "Globex",
    });
  });

  it("reports hiding a section, which is not the same as deleting it", () => {
    const section = experienceSection();
    const diff = diffResumeDocuments(
      document({ sections: [section] }),
      document({ sections: [{ ...section, visible: false }] }),
    );

    expect(find(diff.entries, "section:sec-experience.visible")).toMatchObject({
      kind: "changed",
      before: "Yes",
      after: "No",
    });
  });

  it("keeps the direction of the arguments: before is the stored version", () => {
    const diff = diffResumeDocuments(
      withBasics({ headline: "Old" }),
      withBasics({ headline: "New" }),
    );

    expect(diff.entries[0]).toMatchObject({ before: "Old", after: "New" });
  });

  it("counts each kind of change separately", () => {
    const before = document({
      ...withBasics({ fullName: "Ada", headline: "Analyst" }),
      sections: [experienceSection(experience("item-1", { company: "Acme" }))],
    });
    const after = document({
      ...withBasics({ fullName: "Ada Lovelace", headline: "" }),
      sections: [
        experienceSection(
          experience("item-1", { company: "Acme" }),
          experience("item-2", { company: "Globex" }),
        ),
      ],
    });

    const diff = diffResumeDocuments(before, after);

    expect(diff).toMatchObject({ changed: 1, removed: 1, added: 1 });
    expect(diff.entries).toHaveLength(3);
  });

  it("distinguishes two blank items rather than merging them", () => {
    const diff = diffResumeDocuments(
      document({ sections: [experienceSection()] }),
      document({
        sections: [experienceSection(experience("aaaaaaaa-1111"), experience("bbbbbbbb-2222"))],
      }),
    );

    expect(diff.added).toBe(2);
    expect(new Set(diff.entries.map((entry) => entry.after)).size).toBe(2);
  });
});

describe("isSameDocument", () => {
  it("holds for a document compared with itself", () => {
    const doc = emptyResumeDocument();

    expect(isSameDocument(doc, doc)).toBe(true);
    expect(isSameDocument(doc, emptyResumeDocument())).toBe(true);
  });

  it("ignores key order, which `jsonb` does not preserve", () => {
    const base = emptyResumeDocument();
    const reordered = {
      sections: base.sections,
      basics: { ...base.basics },
      version: base.version,
    } as ResumeDocument;

    expect(isSameDocument(base, reordered)).toBe(true);
  });

  it("fails on a single changed field", () => {
    expect(isSameDocument(withBasics({ fullName: "Ada" }), withBasics({ fullName: "Ada K" }))).toBe(
      false,
    );
  });

  it("fails on a reorder, because order is meaning in a resume", () => {
    const first = experience("item-1");
    const second = experience("item-2");

    expect(
      isSameDocument(
        document({ sections: [experienceSection(first, second)] }),
        document({ sections: [experienceSection(second, first)] }),
      ),
    ).toBe(false);
  });

  it("fails when one side has a field the other lacks", () => {
    const base = emptyResumeDocument();

    expect(
      isSameDocument(base, { ...base, basics: { ...base.basics, extra: 1 } } as ResumeDocument),
    ).toBe(false);
  });
});
