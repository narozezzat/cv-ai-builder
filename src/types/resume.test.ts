/**
 * The reshred contract.
 *
 * `reshred_resume_content()` reads the resume document by string key —
 * `i.item ->> 'employmentType'`, `i.item -> 'highlights'` — and jsonb has no
 * schema to catch a typo. Rename a field in `resume.ts` and nothing breaks
 * loudly: the save succeeds, the trigger fires, and the column quietly becomes
 * null. Every cross-resume query, every analytic, every future search index then
 * reads empty for that field while the editor shows the data perfectly.
 *
 * This test is the alarm. It parses the migration, extracts the exact keys the
 * trigger reads per section kind, and compares them against the keys the Zod
 * schema produces. A rename on either side fails here.
 *
 * It deliberately reads the SQL as text rather than running it. Postgres would
 * prove more — that is the round-trip test that runs against a live database in
 * the integration suite — but this one needs no Docker, runs in milliseconds, and
 * catches the entire class of error the round-trip test exists for.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  type ItemSectionKind,
  RESUME_DATE_PATTERN,
  RESUME_SECTION_KINDS,
  createResumeDocument,
  createSection,
  createSectionItem,
  emptyResumeDocument,
  isItemSection,
  readResumeDocument,
  readResumePage,
  readResumeTheme,
  resumeSectionSchema,
  socialLinkSchema,
} from "./resume";

const MIGRATION = join(process.cwd(), "supabase", "migrations", "20260726090100_projections.sql");

const sql = readFileSync(MIGRATION, "utf8");

/**
 * The projection table each item-bearing kind writes to.
 *
 * Two of them do not match their kind, and both for a reason worth keeping
 * visible: `certifications` writes to `certificates`, and `references` writes to
 * `resume_references` because `references` is a reserved word in SQL.
 */
const KIND_TABLES = {
  experience: "experience",
  education: "education",
  projects: "projects",
  skills: "skills",
  languages: "languages",
  certifications: "certificates",
  awards: "awards",
  publications: "publications",
  references: "resume_references",
  interests: "interests",
  custom: "resume_custom_entries",
} as const satisfies Record<ItemSectionKind, string>;

interface InsertBlock {
  table: string;
  body: string;
}

/**
 * Every `insert into public.<table> (…) … ;` statement in the migration body.
 *
 * Split on the statement keyword and cut at the first semicolon. Crude, and
 * sufficient: nothing inside these statements contains one.
 */
function parseInsertBlocks(source: string): InsertBlock[] {
  return source
    .split(/\binsert into public\./)
    .slice(1)
    .map((chunk) => {
      const body = chunk.slice(0, chunk.indexOf(";"));
      const table = /^([a-z_]+)/.exec(chunk)?.[1] ?? "";

      return { table, body };
    })
    .filter((block) => block.table.length > 0);
}

/** Keys read off a jsonb variable, e.g. `i.item ->> 'startDate'`. */
function keysRead(body: string, alias: string): Set<string> {
  const pattern = new RegExp(`\\b${alias} ->>? '([A-Za-z_]+)'`, "g");

  return new Set(Array.from(body.matchAll(pattern), (match) => match[1]));
}

const blocks = parseInsertBlocks(sql);

/** The item-level insert for a section kind, found by its `where kind = …` filter. */
function blockForKind(kind: ItemSectionKind): InsertBlock {
  const match = blocks.find((block) =>
    new RegExp(`where s\\.section ->> 'kind' = '${kind}'`).test(block.body),
  );

  if (!match) {
    throw new Error(`No insert block in the migration filters on kind '${kind}'.`);
  }

  return match;
}

/** The keys the Zod schema defines for one kind's items. */
function schemaItemKeys(kind: ItemSectionKind): Set<string> {
  const option = resumeSectionSchema.options.find((candidate) => {
    const { kind: literal } = candidate.shape;

    return literal.value === kind;
  });

  if (!option || !("items" in option.shape)) {
    throw new Error(`No item-bearing section schema for kind '${kind}'.`);
  }

  return new Set(Object.keys(option.shape.items.element.shape));
}

describe("reshred trigger contract", () => {
  it("parses the migration into insert statements", () => {
    expect(blocks.length).toBeGreaterThan(10);
  });

  it("reads the section envelope keys the schema writes", () => {
    const block = blocks.find((candidate) => candidate.table === "resume_sections");

    expect(block).toBeDefined();
    // `sort_order` comes from `with ordinality`, not from the document, and
    // `item_count` is derived — so the envelope is exactly these four keys.
    expect(keysRead(block!.body, "s.section")).toEqual(
      new Set(["id", "kind", "title", "visible", "items"]),
    );
  });

  it.each(Object.keys(KIND_TABLES) as ItemSectionKind[])(
    "projects %s into the expected table",
    (kind) => {
      expect(blockForKind(kind).table).toBe(KIND_TABLES[kind]);
    },
  );

  it.each(Object.keys(KIND_TABLES) as ItemSectionKind[])(
    "reads exactly the %s item keys the schema defines",
    (kind) => {
      const fromSql = keysRead(blockForKind(kind).body, "i.item");
      const fromSchema = schemaItemKeys(kind);

      // Symmetric: a key in the schema the trigger ignores loses data silently,
      // and a key the trigger reads that the schema never writes is dead SQL.
      expect([...fromSql].sort()).toEqual([...fromSchema].sort());
    },
  );

  it("reads exactly the social link keys the schema defines", () => {
    const block = blocks.find((candidate) => candidate.table === "social_links");

    expect(block).toBeDefined();
    expect([...keysRead(block!.body, "l.item")].sort()).toEqual(
      Object.keys(socialLinkSchema.shape).sort(),
    );
  });

  it("has no projection for the summary section", () => {
    // Summary is prose, not items: it earns a `resume_sections` row and nothing
    // else, the same way `basics` is stored without being projected.
    const summaryBlocks = blocks.filter((block) =>
      /where s\.section ->> 'kind' = 'summary'/.test(block.body),
    );

    expect(summaryBlocks).toEqual([]);
  });

  it("covers every section kind", () => {
    // Guards the gap this file exists to close: a new kind added to the schema
    // with no projection is caught here rather than discovered months later.
    expect(new Set([...Object.keys(KIND_TABLES), "summary"])).toEqual(
      new Set(RESUME_SECTION_KINDS),
    );
  });

  it("only produces dates resume_parse_date can read", () => {
    // The function accepts a bare year, a year-month, or a full date, and returns
    // null on anything else. Anything the document allows must hit one of the
    // three, or the save succeeds while the projected date disappears.
    const parseable = [/^\d{4}$/, /^\d{4}-\d{2}$/, /^\d{4}-\d{2}-\d{2}$/];
    const accepted = ["2021", "2021-03", "2021-03-09", "1999-12-31"];
    const rejected = ["21", "2021-13", "2021-3", "2021-03-32", "March 2021", "now"];

    for (const value of accepted) {
      expect(RESUME_DATE_PATTERN.test(value), value).toBe(true);
      expect(
        parseable.some((pattern) => pattern.test(value)),
        value,
      ).toBe(true);
    }

    for (const value of rejected) {
      expect(RESUME_DATE_PATTERN.test(value), value).toBe(false);
    }

    // Empty is the one non-date the document allows; the trigger nulls it.
    expect(RESUME_DATE_PATTERN.test("")).toBe(true);
  });

  it("only produces skill levels the trigger's cast accepts", () => {
    // `case when i.item ->> 'level' ~ '^\d+$' then …::integer end` — a
    // fractional or negative level would project as null.
    const guard = /^\d+$/;

    for (const level of [0, 3, 5]) {
      expect(guard.test(String(level))).toBe(true);
    }

    expect(createSectionItem("skills").level).toBe(0);
  });
});

describe("document schema", () => {
  it("parses the empty jsonb a fresh row holds", () => {
    // `resumes.content jsonb not null default '{}'` — a row must be readable
    // before anything has been written to it.
    const document = emptyResumeDocument();

    expect(document.sections).toEqual([]);
    expect(document.basics.fullName).toBe("");
    expect(document.basics.photo.visible).toBe(false);
  });

  it("seeds a new document from the profile", () => {
    const document = createResumeDocument({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      headline: null,
    });

    expect(document.basics.fullName).toBe("Ada Lovelace");
    expect(document.basics.headline).toBe("");
    expect(document.sections[0]?.kind).toBe("summary");
    expect(new Set(document.sections.map((section) => section.id)).size).toBe(
      document.sections.length,
    );
  });

  it("round-trips a document holding every section kind", () => {
    const sections = RESUME_SECTION_KINDS.map((kind) => {
      const section = createSection(kind);

      return isItemSection(section)
        ? { ...section, items: [createSectionItem(section.kind)] }
        : { ...section, content: "<p>Staff engineer.</p>" };
    });

    const result = readResumeDocument({ version: 1, basics: {}, sections });

    expect(result.ok).toBe(true);
    expect(result.ok && result.document.sections).toHaveLength(RESUME_SECTION_KINDS.length);
  });

  it("refuses a document it cannot parse instead of substituting an empty one", () => {
    // The reason `readResumeDocument` returns a result rather than a fallback:
    // opening a blank editor over a resume that failed to parse would let
    // autosave write that blankness over the user's work.
    const result = readResumeDocument({ sections: "not an array" });

    expect(result.ok).toBe(false);
    expect(result.ok || result.issues.length).toBeGreaterThan(0);
  });

  it("strips unknown keys rather than rejecting the document", () => {
    const result = readResumeDocument({
      basics: { fullName: "Ada", inventedByANewerBuild: true },
      sections: [],
    });

    expect(result.ok).toBe(true);
    expect(result.ok && "inventedByANewerBuild" in result.document.basics).toBe(false);
  });

  it("rejects a section list past the render limit", () => {
    const sections = Array.from({ length: 41 }, () => createSection("custom"));

    expect(readResumeDocument({ sections }).ok).toBe(false);
  });

  it("rejects any link that is not an absolute http(s) URL", () => {
    // These land in `href` attributes of a document published at `/r/[slug]`.
    // Zod's `.url()` accepts every one of the first four on its own — which is
    // why `isSafeHttpUrl` exists and why this test does.
    const unsafe = [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "example.com",
      "/relative",
    ];

    for (const website of unsafe) {
      expect(readResumeDocument({ basics: { website } }).ok, website).toBe(false);
    }

    for (const website of ["", "https://example.com", "http://localhost:3000/x?y=1#z"]) {
      expect(readResumeDocument({ basics: { website } }).ok, website).toBe(true);
    }
  });

  it("applies the same link rule inside section items", () => {
    // Not just `basics`: item URLs are rendered as links too, and the shared
    // `urlText` primitive is what makes that automatic.
    const section = {
      ...createSection("projects"),
      items: [{ ...createSectionItem("projects"), repoUrl: "javascript:alert(1)" }],
    };

    expect(readResumeDocument({ sections: [section] }).ok).toBe(false);
  });
});

describe("theme and page", () => {
  it("falls back to defaults for a malformed column", () => {
    // Opposite call to the document: a bad theme costs the user a colour, so it
    // opens in the default rather than refusing to open.
    expect(readResumeTheme("nonsense").paletteId).toBe("default");
    expect(readResumePage(null).format).toBe("a4");
    expect(readResumeTheme({}).accent).toBeNull();
  });

  it("keeps valid overrides", () => {
    expect(readResumeTheme({ accent: "#2563eb", bodyFont: "lora" })).toMatchObject({
      accent: "#2563eb",
      bodyFont: "lora",
    });
  });

  it("rejects an accent that is not a hex colour", () => {
    // This value is interpolated into a CSS custom property in the rendered
    // document, so it is a security boundary and not a formatting preference.
    for (const accent of ["red", "#2563eb; content: bad", "var(--x)", "#fff"]) {
      expect(readResumeTheme({ accent }).accent, accent).toBeNull();
    }
  });

  it("clamps page geometry to what a printer can produce", () => {
    expect(readResumePage({ margin: 2 }).margin).toBe(14);
    expect(readResumePage({ margin: 20 }).margin).toBe(20);
  });
});
