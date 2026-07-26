import { beforeEach, describe, expect, it } from "vitest";

import {
  RESUME_LIMITS,
  RESUME_PAGE_DEFAULTS,
  RESUME_THEME_DEFAULTS,
  type ResumeDocument,
  createSection,
  emptyResumeDocument,
  isItemSection,
} from "@/types/resume";

import {
  type InitializeResumeInput,
  selectCanRedo,
  selectCanUndo,
  selectIsDirty,
  useResumeStore,
} from "./resume-store";

/**
 * A document with one known section, so tests index into it without depending on
 * whatever the starter set happens to contain.
 */
function documentWithExperience(): ResumeDocument {
  return { ...emptyResumeDocument(), sections: [createSection("experience")] };
}

function initInput(overrides: Partial<InitializeResumeInput> = {}): InitializeResumeInput {
  return {
    resumeId: "resume-1",
    title: "Backend Engineer",
    document: documentWithExperience(),
    theme: RESUME_THEME_DEFAULTS,
    page: RESUME_PAGE_DEFAULTS,
    templateId: "modern-slate",
    savedAt: "2026-07-26T10:00:00.000Z",
    ...overrides,
  };
}

const store = () => useResumeStore.getState();

/** The first section's id, which every fixture guarantees exists. */
const firstSectionId = (): string => {
  const section = store().draft.document.sections[0];

  if (!section) {
    throw new Error("fixture has no sections");
  }

  return section.id;
};

beforeEach(() => {
  useResumeStore.getState().reset();
});

describe("initialize", () => {
  it("installs the resume clean, with the first section open", () => {
    const input = initInput();
    store().initialize(input);

    const state = store();

    expect(state.resumeId).toBe("resume-1");
    expect(state.draft.title).toBe("Backend Engineer");
    expect(state.status).toBe("idle");
    expect(selectIsDirty(state)).toBe(false);
    expect(state.activeSectionId).toBe(input.document.sections[0]?.id);
    expect(selectCanUndo(state)).toBe(false);
  });

  it("ignores edits before a resume is open", () => {
    store().setTitle("nowhere to save this");

    expect(store().draft.title).toBe("");
    expect(store().status).toBe("idle");
  });

  it("keeps unsaved work when the same resume is re-initialized", () => {
    store().initialize(initInput());
    store().setTitle("edited");

    store().initialize(initInput({ title: "stale server copy" }));

    expect(store().draft.title).toBe("edited");
  });

  it("installs a different resume even when the current one is dirty", () => {
    store().initialize(initInput());
    store().setTitle("edited");

    store().initialize(initInput({ resumeId: "resume-2", title: "Other" }));

    expect(store().resumeId).toBe("resume-2");
    expect(store().draft.title).toBe("Other");
  });

  it("replaceFromServer discards local work and the history", () => {
    store().initialize(initInput());
    store().setTitle("edited");

    store().replaceFromServer(initInput({ title: "server wins" }));

    const state = store();

    expect(state.draft.title).toBe("server wins");
    expect(selectIsDirty(state)).toBe(false);
    expect(selectCanUndo(state)).toBe(false);
  });
});

describe("editing", () => {
  beforeEach(() => {
    store().initialize(initInput());
  });

  it("marks the draft dirty and records history", () => {
    store().setBasics({ fullName: "Ada Lovelace" });

    const state = store();

    expect(state.draft.document.basics.fullName).toBe("Ada Lovelace");
    expect(state.status).toBe("dirty");
    expect(selectIsDirty(state)).toBe(true);
    expect(selectCanUndo(state)).toBe(true);
  });

  it("drops an edit that changes nothing", () => {
    store().setBasics({ fullName: "Ada" });
    const afterFirst = store().draft;

    store().setBasics({ fullName: "Ada" });

    expect(store().draft).toBe(afterFirst);
    expect(store().history.past).toHaveLength(1);
  });

  it("skips undefined values instead of writing them over required fields", () => {
    store().setBasics({ fullName: "Ada", headline: undefined });

    expect(store().draft.document.basics.headline).toBe("");
  });

  it("folds a typing run in one field into a single undo step", () => {
    store().setBasics({ fullName: "A" }, "basics:fullName");
    store().setBasics({ fullName: "Ad" }, "basics:fullName");
    store().setBasics({ fullName: "Ada" }, "basics:fullName");

    expect(store().history.past).toHaveLength(1);

    store().undo();

    expect(store().draft.document.basics.fullName).toBe("");
  });

  it("does not fold edits to different fields", () => {
    store().setBasics({ fullName: "Ada" }, "basics:fullName");
    store().setBasics({ email: "ada@example.com" }, "basics:email");

    expect(store().history.past).toHaveLength(2);
  });

  it("round-trips undo and redo", () => {
    store().setTitle("v2");
    store().undo();

    expect(store().draft.title).toBe("Backend Engineer");
    expect(selectCanRedo(store())).toBe(true);

    store().redo();

    expect(store().draft.title).toBe("v2");
  });

  it("keeps the saving status while a request is open", () => {
    store().markSaving();
    store().setTitle("typed mid-flight");

    expect(store().status).toBe("saving");
  });

  it("does not let typing paper over a conflict", () => {
    store().markConflict("Opened in another tab");
    store().setTitle("typed");

    const state = store();

    expect(state.status).toBe("conflict");
    expect(state.error).toBe("Opened in another tab");
  });
});

describe("sections", () => {
  beforeEach(() => {
    store().initialize(initInput());
  });

  it("adds a section, opens it, and returns its id", () => {
    const id = store().addSection("skills");

    expect(id).not.toBeNull();
    expect(store().draft.document.sections).toHaveLength(2);
    expect(store().activeSectionId).toBe(id);
  });

  it("refuses to add past the section limit", () => {
    while (store().draft.document.sections.length < RESUME_LIMITS.sections) {
      expect(store().addSection("skills")).not.toBeNull();
    }

    expect(store().addSection("skills")).toBeNull();
    expect(store().draft.document.sections).toHaveLength(RESUME_LIMITS.sections);
  });

  it("renames, hides, and reorders", () => {
    const sectionId = firstSectionId();
    const second = store().addSection("education");

    store().renameSection(sectionId, "Work");
    store().setSectionVisibility(sectionId, false);
    store().moveSection(0, 1);

    const sections = store().draft.document.sections;

    expect(sections[1]?.id).toBe(sectionId);
    expect(sections[1]?.title).toBe("Work");
    expect(sections[1]?.visible).toBe(false);
    expect(sections[0]?.id).toBe(second);
  });

  it("ignores an out-of-range reorder without touching the draft", () => {
    const before = store().draft;

    store().moveSection(0, 9);

    expect(store().draft).toBe(before);
  });

  it("closes the panel of a section it removes", () => {
    const sectionId = firstSectionId();

    store().removeSection(sectionId);

    expect(store().draft.document.sections).toHaveLength(0);
    expect(store().activeSectionId).toBeNull();
  });

  it("writes summary content only to a summary section", () => {
    const summaryId = store().addSection("summary");
    const experienceId = firstSectionId();

    store().setSummary(summaryId ?? "", "<p>Ten years of backend work.</p>");
    store().setSummary(experienceId, "<p>should not land</p>");

    const summary = store().draft.document.sections.find((section) => section.id === summaryId);
    const experience = store().draft.document.sections.find(
      (section) => section.id === experienceId,
    );

    expect(summary?.kind === "summary" && summary.content).toBe(
      "<p>Ten years of backend work.</p>",
    );
    expect(isItemSection(experience!)).toBe(true);
  });
});

describe("items", () => {
  let sectionId: string;

  beforeEach(() => {
    store().initialize(initInput());
    sectionId = firstSectionId();
  });

  const items = () => {
    const section = store().draft.document.sections.find((candidate) => candidate.id === sectionId);

    return section && isItemSection(section) ? section.items : [];
  };

  it("adds an item and patches it by kind", () => {
    const itemId = store().addItem("experience", sectionId);

    expect(itemId).not.toBeNull();

    store().updateItem("experience", sectionId, itemId ?? "", { company: "Stripe" });

    expect(items()).toHaveLength(1);
    expect(items()[0]).toMatchObject({ id: itemId, company: "Stripe" });
  });

  it("refuses to add an item of the wrong kind", () => {
    expect(store().addItem("education", sectionId)).toBeNull();
    expect(items()).toHaveLength(0);
  });

  it("patches array fields wholesale", () => {
    const itemId = store().addItem("experience", sectionId) ?? "";

    store().updateItem("experience", sectionId, itemId, {
      highlights: ["Cut p99 latency in half", "Owned the payments migration"],
    });

    expect(items()[0]).toMatchObject({
      highlights: expect.arrayContaining(["Cut p99 latency in half"]),
    });
  });

  it("duplicates directly below the original with a fresh id", () => {
    const first = store().addItem("experience", sectionId) ?? "";
    store().updateItem("experience", sectionId, first, { company: "Stripe" });
    store().addItem("experience", sectionId);

    const copyId = store().duplicateItem(sectionId, first);

    expect(copyId).not.toBeNull();
    expect(copyId).not.toBe(first);
    expect(items().map((item) => item.id)).toEqual([first, copyId, items()[2]?.id]);
    expect(items()[1]).toMatchObject({ company: "Stripe" });
  });

  it("removes and reorders items", () => {
    const first = store().addItem("experience", sectionId) ?? "";
    const second = store().addItem("experience", sectionId) ?? "";

    store().moveItem(sectionId, 0, 1);

    expect(items().map((item) => item.id)).toEqual([second, first]);

    store().removeItem(sectionId, second);

    expect(items().map((item) => item.id)).toEqual([first]);
  });

  it("refuses to add past the per-section item limit", () => {
    while (items().length < RESUME_LIMITS.itemsPerSection) {
      expect(store().addItem("experience", sectionId)).not.toBeNull();
    }

    expect(store().addItem("experience", sectionId)).toBeNull();
    expect(store().duplicateItem(sectionId, items()[0]?.id ?? "")).toBeNull();
  });
});

describe("socials", () => {
  beforeEach(() => {
    store().initialize(initInput());
  });

  const socials = () => store().draft.document.basics.socials;

  it("adds, patches, reorders, and removes", () => {
    const first = store().addSocial() ?? "";
    const second = store().addSocial() ?? "";

    store().updateSocial(first, { network: "github", username: "ada" });
    store().moveSocial(0, 1);

    expect(socials().map((social) => social.id)).toEqual([second, first]);
    expect(socials()[1]).toMatchObject({ network: "github", username: "ada" });

    store().removeSocial(second);

    expect(socials().map((social) => social.id)).toEqual([first]);
  });

  it("refuses to add past the limit", () => {
    while (socials().length < RESUME_LIMITS.socials) {
      expect(store().addSocial()).not.toBeNull();
    }

    expect(store().addSocial()).toBeNull();
  });
});

describe("theme, page, and template", () => {
  beforeEach(() => {
    store().initialize(initInput());
  });

  it("patches theme and page without dropping untouched keys", () => {
    store().setTheme({ accent: "#1d4ed8", headingFont: undefined });
    store().setPage({ format: "letter" });

    const state = store();

    expect(state.draft.theme).toMatchObject({
      accent: "#1d4ed8",
      headingFont: RESUME_THEME_DEFAULTS.headingFont,
      fontSize: RESUME_THEME_DEFAULTS.fontSize,
    });
    expect(state.draft.page.format).toBe("letter");
  });

  it("switches template as its own undo step", () => {
    store().setTemplateId("editorial-noir");
    store().undo();

    expect(store().draft.templateId).toBe("modern-slate");
  });
});

describe("replaceDocument", () => {
  it("swaps the document in one undoable step", () => {
    store().initialize(initInput());
    const original = store().draft.document;

    store().replaceDocument({ ...emptyResumeDocument(), sections: [createSection("skills")] });

    expect(store().draft.document.sections[0]?.kind).toBe("skills");

    store().undo();

    expect(store().draft.document).toBe(original);
  });
});

describe("save bookkeeping", () => {
  beforeEach(() => {
    store().initialize(initInput());
  });

  it("goes clean when the persisted snapshot is the current one", () => {
    store().setTitle("v2");
    const inFlight = store().draft;

    store().markSaving();
    store().markSaved({ draft: inFlight, savedAt: "2026-07-26T10:05:00.000Z" });

    const state = store();

    expect(state.status).toBe("saved");
    expect(state.savedAt).toBe("2026-07-26T10:05:00.000Z");
    expect(selectIsDirty(state)).toBe(false);
  });

  it("stays dirty when the user typed while the save was in flight", () => {
    store().setTitle("v2");
    const inFlight = store().draft;

    store().markSaving();
    store().setTitle("v3");
    store().markSaved({ draft: inFlight, savedAt: "2026-07-26T10:05:00.000Z" });

    const state = store();

    expect(state.status).toBe("dirty");
    expect(state.draft.title).toBe("v3");
    expect(selectIsDirty(state)).toBe(true);
  });

  it("carries a message on error and conflict", () => {
    store().markError("Network unreachable");

    expect(store()).toMatchObject({ status: "error", error: "Network unreachable" });

    store().markConflict("Newer version exists");

    expect(store()).toMatchObject({ status: "conflict", error: "Newer version exists" });
  });
});
