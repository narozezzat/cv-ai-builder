"use client";

/**
 * The editor's state: one resume, everything that can be edited about it, and the
 * undo stack that covers all of it.
 *
 * Three properties are load-bearing:
 *
 * 1. **The tracked value is exactly what gets saved.** `draft` holds the four
 *    columns autosave writes plus the title — nothing else. UI state (which
 *    accordion is open, what is selected) lives beside it and is deliberately
 *    outside the draft, because undo should move the user's document, not their
 *    scroll position.
 *
 * 2. **Structural sharing decides everything.** Every mutation runs through Immer's
 *    `produce`, so an edit that changes nothing returns the same reference. That
 *    single fact powers three separate mechanisms: a no-op edit is dropped instead
 *    of pushed onto the history, `draft !== saved` is an exact dirty check with no
 *    deep comparison, and a preview subscribed to `draft.document.sections[3]`
 *    re-renders only when that section actually changed.
 *
 * 3. **A save in flight cannot swallow edits made during it.** `markSaved` takes the
 *    snapshot that was actually persisted, not "whatever is current now". If the
 *    user typed while the request was open, the store stays dirty and the next
 *    autosave picks it up. The alternative loses keystrokes silently, which is the
 *    single worst bug an editor can have.
 *
 * The store is a module singleton rather than a per-mount context: only one resume
 * is open at a time, autosave and the keyboard layer both need to reach it from
 * outside the tree, and `initialize` makes re-entry cheap. `initialize` will not
 * clobber unsaved work — see its comment.
 */

import { produce } from "immer";
import { create } from "zustand";

import {
  DEFAULT_TEMPLATE_ID,
  RESUME_LIMITS,
  RESUME_PAGE_DEFAULTS,
  RESUME_THEME_DEFAULTS,
  type ItemSection,
  type ItemSectionKind,
  type ResumeBasics,
  type ResumeDocument,
  type ResumePage,
  type ResumePhoto,
  type ResumeSection,
  type ResumeSectionItem,
  type ResumeSectionKind,
  type ResumeSectionOf,
  type ResumeTheme,
  type SocialLink,
  createResumeId,
  createSection,
  createSectionItem,
  emptyResumeDocument,
  isItemSection,
} from "@/types/resume";
import { moveArrayItem } from "@/utils/array";

import { type History, canRedo, canUndo, commit, createHistory, redo, undo } from "./history";

/**
 * Everything about the open resume that is persisted.
 *
 * `title` is a column on `resumes` rather than part of the document, but it is
 * edited from the same header and saved by the same action, so it belongs in the
 * same undo history. Splitting it out would mean renaming a resume is the one edit
 * `Cmd+Z` cannot reach.
 */
export interface ResumeDraft {
  title: string;
  document: ResumeDocument;
  theme: ResumeTheme;
  page: ResumePage;
  templateId: string;
}

/**
 * What the save indicator shows.
 *
 * `conflict` is terminal until the user resolves it: the row was modified by
 * something else (another tab, another device) since we last read it, so writing
 * again would overwrite work we never saw.
 */
export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

export interface ResumeEditorState {
  /** `null` until `initialize` runs. Guards autosave against firing on a blank store. */
  resumeId: string | null;
  draft: ResumeDraft;
  /** The last snapshot known to be in the database. Identity-compared for dirtiness. */
  saved: ResumeDraft;
  /**
   * `resumes.updated_at` as of the last successful read or write.
   *
   * Sent back as the optimistic-concurrency token: the update matches on it, so a
   * row someone else touched in the meantime updates zero rows instead of
   * overwriting them.
   */
  savedAt: string | null;
  history: History<ResumeDraft>;
  status: SaveStatus;
  /** User-facing explanation for `error` and `conflict`. */
  error: string | null;
  /** Which section panel is expanded. UI state, intentionally outside the draft. */
  activeSectionId: string | null;
}

export interface InitializeResumeInput {
  resumeId: string;
  title: string;
  document: ResumeDocument;
  theme: ResumeTheme;
  page: ResumePage;
  templateId: string;
  savedAt: string | null;
}

export interface MarkSavedInput {
  /** The snapshot the server accepted — not the current draft. See the file header. */
  draft: ResumeDraft;
  savedAt: string;
}

export interface ResumeEditorActions {
  /**
   * Installs a resume loaded from the server.
   *
   * A no-op when the same resume is already open with unsaved edits. Effects run
   * twice in development, an RSC re-render re-supplies the same props, and a stale
   * server payload arriving after the user has started typing must not win — in all
   * three cases the correct behaviour is to keep what the user has. Use
   * `replaceFromServer` for the deliberate "discard mine, take theirs" path.
   */
  initialize: (input: InitializeResumeInput) => void;
  /**
   * Force-installs server state, discarding local edits and the undo history.
   *
   * The resolution for a `conflict`, and only ever called from a prompt the user
   * answered — it destroys unsaved work by design.
   */
  replaceFromServer: (input: InitializeResumeInput) => void;
  /** Returns the store to its blank state. Called when the editor unmounts. */
  reset: () => void;

  setTitle: (title: string) => void;
  setBasics: (patch: Partial<ResumeBasics>, coalesceKey?: string) => void;
  setPhoto: (patch: Partial<ResumePhoto>) => void;

  /** Returns the new link's id for focus handling, or `null` at the cap. */
  addSocial: () => string | null;
  updateSocial: (id: string, patch: Partial<SocialLink>, coalesceKey?: string) => void;
  removeSocial: (id: string) => void;
  moveSocial: (from: number, to: number) => void;

  /** Returns the new section's id, or `null` at the cap. */
  addSection: <TKind extends ResumeSectionKind>(kind: TKind, title?: string) => string | null;
  removeSection: (sectionId: string) => void;
  renameSection: (sectionId: string, title: string) => void;
  setSectionVisibility: (sectionId: string, visible: boolean) => void;
  moveSection: (from: number, to: number) => void;
  /** Rich-text HTML for a summary section. Sanitized before it reaches here. */
  setSummary: (sectionId: string, content: string) => void;

  /** Returns the new item's id, or `null` at the cap or on a kind mismatch. */
  addItem: <TKind extends ItemSectionKind>(kind: TKind, sectionId: string) => string | null;
  /**
   * Patches one item.
   *
   * `kind` is passed explicitly so `patch` is checked against that kind's fields
   * rather than against a union that would accept any item's keys. Callers are
   * per-kind form components, so they know it statically.
   *
   * Array fields (highlights, keywords, technologies) are patched wholesale —
   * `{ highlights: next }` — rather than through per-element actions. The bullet
   * editor owns that array's ordering and the store stays out of it.
   */
  updateItem: <TKind extends ItemSectionKind>(
    kind: TKind,
    sectionId: string,
    itemId: string,
    patch: Partial<ResumeSectionOf<TKind>["items"][number]>,
    coalesceKey?: string,
  ) => void;
  /** Returns the copy's id, or `null` at the cap. */
  duplicateItem: (sectionId: string, itemId: string) => string | null;
  removeItem: (sectionId: string, itemId: string) => void;
  moveItem: (sectionId: string, from: number, to: number) => void;

  setTheme: (patch: Partial<ResumeTheme>) => void;
  setPage: (patch: Partial<ResumePage>) => void;
  setTemplateId: (templateId: string) => void;

  /**
   * Swaps the whole document in one undoable step.
   *
   * For version restore, JSON/PDF import, and any AI action that rewrites more than
   * one field. Going through the history is the point: a restore the user cannot
   * undo is a restore they will not risk trying.
   */
  replaceDocument: (document: ResumeDocument) => void;

  undo: () => void;
  redo: () => void;

  setActiveSectionId: (sectionId: string | null) => void;

  markSaving: () => void;
  markSaved: (input: MarkSavedInput) => void;
  markConflict: (message: string) => void;
  markError: (message: string) => void;
}

export type ResumeEditorStore = ResumeEditorState & ResumeEditorActions;

function emptyDraft(): ResumeDraft {
  return {
    title: "",
    document: emptyResumeDocument(),
    theme: RESUME_THEME_DEFAULTS,
    page: RESUME_PAGE_DEFAULTS,
    templateId: DEFAULT_TEMPLATE_ID,
  };
}

function initialState(): ResumeEditorState {
  const draft = emptyDraft();

  return {
    resumeId: null,
    draft,
    // Same reference, so a freshly initialized store is not dirty.
    saved: draft,
    savedAt: null,
    history: createHistory<ResumeDraft>(),
    status: "idle",
    error: null,
    activeSectionId: null,
  };
}

function stateFrom(input: InitializeResumeInput): ResumeEditorState {
  const draft: ResumeDraft = {
    title: input.title,
    document: input.document,
    theme: input.theme,
    page: input.page,
    templateId: input.templateId,
  };

  return {
    resumeId: input.resumeId,
    draft,
    saved: draft,
    savedAt: input.savedAt,
    history: createHistory<ResumeDraft>(),
    status: "idle",
    error: null,
    activeSectionId: input.document.sections[0]?.id ?? null,
  };
}

/**
 * The status an edit should leave behind.
 *
 * `saving` survives an edit so the indicator does not flicker back to "unsaved"
 * mid-request, and `conflict` survives because typing does not resolve it — only
 * answering the prompt does.
 */
function statusAfterEdit(state: ResumeEditorState): Pick<ResumeEditorState, "status" | "error"> {
  return state.status === "saving" || state.status === "conflict"
    ? { status: state.status, error: state.error }
    : { status: "dirty", error: null };
}

/**
 * Copies defined values from `patch` onto `target`.
 *
 * `undefined` is skipped rather than assigned. Every string field in the document
 * schema is required-and-possibly-empty, so writing `undefined` over one would fail
 * validation at save time — long after the keystroke that caused it. `Partial<T>`
 * makes that mistake expressible, so it is filtered here once instead of guarded at
 * two dozen call sites.
 */
function assignDefined<TTarget extends object>(target: TTarget, patch: Partial<TTarget>): void {
  const writable = target as unknown as Record<string, unknown>;

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      writable[key] = value;
    }
  }
}

function sectionById(draft: ResumeDraft, sectionId: string): ResumeSection | undefined {
  return draft.document.sections.find((section) => section.id === sectionId);
}

/**
 * A section's items as a single array type.
 *
 * `ItemSection["items"]` is a union of eleven array types, and `push` on a union of
 * arrays requires an argument assignable to *every* member — impossible. The kind
 * check the caller has already performed is exactly what TypeScript cannot see
 * through a `find` over a discriminated union, so the widening happens here, once,
 * where the reason for it can be written down.
 */
function itemsOf(section: ItemSection): ResumeSectionItem[] {
  return section.items;
}

/** The section, if it exists and holds items of `kind`. */
function itemSectionOfKind(
  draft: ResumeDraft,
  sectionId: string,
  kind: ItemSectionKind,
): ItemSection | null {
  const section = sectionById(draft, sectionId);

  if (!section || section.kind !== kind || !isItemSection(section)) {
    return null;
  }

  return section;
}

export const useResumeStore = create<ResumeEditorStore>()((set, get) => {
  /**
   * The single write path for anything in the draft.
   *
   * Produces the next draft, drops it if nothing changed, and records one history
   * entry — so no action can forget to make itself undoable.
   */
  function mutate(recipe: (draft: ResumeDraft) => void, coalesceKey?: string): void {
    const state = get();

    if (!state.resumeId) {
      // Editing a store nobody has initialized would produce a draft with no row to
      // save it to, and autosave would then either no-op forever or invent a target.
      return;
    }

    const next = produce(state.draft, recipe);

    if (Object.is(next, state.draft)) {
      return;
    }

    set({
      draft: next,
      history: commit(state.history, state.draft, next, { coalesceKey, now: Date.now() }),
      ...statusAfterEdit(state),
    });
  }

  /** Undo and redo differ only in which reducer they call. */
  function step(direction: "undo" | "redo"): void {
    const state = get();
    const result =
      direction === "undo"
        ? undo(state.history, state.draft)
        : redo(state.history, state.draft, Date.now());

    if (!result) {
      return;
    }

    set({
      draft: result.value,
      history: result.history,
      ...statusAfterEdit(state),
    });
  }

  return {
    ...initialState(),

    initialize: (input) => {
      const state = get();
      const isSameResume = state.resumeId === input.resumeId;
      const hasUnsavedWork = !Object.is(state.draft, state.saved);

      if (isSameResume && hasUnsavedWork) {
        return;
      }

      set(stateFrom(input));
    },

    replaceFromServer: (input) => {
      set(stateFrom(input));
    },

    reset: () => {
      set(initialState());
    },

    setTitle: (title) => {
      mutate((draft) => {
        draft.title = title;
      }, "title");
    },

    setBasics: (patch, coalesceKey) => {
      mutate((draft) => {
        assignDefined(draft.document.basics, patch);
      }, coalesceKey);
    },

    setPhoto: (patch) => {
      mutate((draft) => {
        assignDefined(draft.document.basics.photo, patch);
      });
    },

    addSocial: () => {
      const { socials } = get().draft.document.basics;

      if (socials.length >= RESUME_LIMITS.socials) {
        return null;
      }

      const social: SocialLink = { id: createResumeId(), network: "", username: "", url: "" };

      mutate((draft) => {
        draft.document.basics.socials.push(social);
      });

      return social.id;
    },

    updateSocial: (id, patch, coalesceKey) => {
      mutate((draft) => {
        const social = draft.document.basics.socials.find((candidate) => candidate.id === id);

        if (social) {
          assignDefined(social, patch);
        }
      }, coalesceKey);
    },

    removeSocial: (id) => {
      mutate((draft) => {
        draft.document.basics.socials = draft.document.basics.socials.filter(
          (social) => social.id !== id,
        );
      });
    },

    moveSocial: (from, to) => {
      mutate((draft) => {
        draft.document.basics.socials = moveArrayItem(draft.document.basics.socials, from, to);
      });
    },

    addSection: (kind, title) => {
      if (get().draft.document.sections.length >= RESUME_LIMITS.sections) {
        return null;
      }

      const section = createSection(kind, title);

      mutate((draft) => {
        draft.document.sections.push(section);
      });

      // Opened as well as added: a section that appears collapsed and empty reads
      // as "nothing happened".
      set({ activeSectionId: section.id });

      return section.id;
    },

    removeSection: (sectionId) => {
      mutate((draft) => {
        draft.document.sections = draft.document.sections.filter(
          (section) => section.id !== sectionId,
        );
      });

      if (get().activeSectionId === sectionId) {
        set({ activeSectionId: null });
      }
    },

    renameSection: (sectionId, title) => {
      mutate((draft) => {
        const section = sectionById(draft, sectionId);

        if (section) {
          section.title = title;
        }
      }, `section:${sectionId}:title`);
    },

    setSectionVisibility: (sectionId, visible) => {
      mutate((draft) => {
        const section = sectionById(draft, sectionId);

        if (section) {
          section.visible = visible;
        }
      });
    },

    moveSection: (from, to) => {
      mutate((draft) => {
        draft.document.sections = moveArrayItem(draft.document.sections, from, to);
      });
    },

    setSummary: (sectionId, content) => {
      mutate((draft) => {
        const section = sectionById(draft, sectionId);

        if (section?.kind === "summary") {
          section.content = content;
        }
      }, `section:${sectionId}:content`);
    },

    addItem: (kind, sectionId) => {
      const section = itemSectionOfKind(get().draft, sectionId, kind);

      if (!section || section.items.length >= RESUME_LIMITS.itemsPerSection) {
        return null;
      }

      const item = createSectionItem(kind);

      mutate((draft) => {
        const target = itemSectionOfKind(draft, sectionId, kind);

        if (target) {
          itemsOf(target).push(item);
        }
      });

      return item.id;
    },

    updateItem: (kind, sectionId, itemId, patch, coalesceKey) => {
      mutate((draft) => {
        const section = itemSectionOfKind(draft, sectionId, kind);
        const item = section
          ? itemsOf(section).find((candidate) => candidate.id === itemId)
          : undefined;

        if (item) {
          assignDefined(item, patch);
        }
      }, coalesceKey);
    },

    duplicateItem: (sectionId, itemId) => {
      const section = sectionById(get().draft, sectionId);

      if (!section || !isItemSection(section)) {
        return null;
      }

      const index = itemsOf(section).findIndex((candidate) => candidate.id === itemId);

      if (index === -1 || section.items.length >= RESUME_LIMITS.itemsPerSection) {
        return null;
      }

      const copyId = createResumeId();

      mutate((draft) => {
        const target = sectionById(draft, sectionId);

        if (!target || !isItemSection(target)) {
          return;
        }

        const items = itemsOf(target);
        const original = items[index];

        if (!original) {
          return;
        }

        // Inserted directly below the original — a duplicate that lands at the
        // bottom of a ten-item list looks like it did not work.
        items.splice(index + 1, 0, { ...original, id: copyId });
      });

      return copyId;
    },

    removeItem: (sectionId, itemId) => {
      mutate((draft) => {
        const section = sectionById(draft, sectionId);

        if (!section || !isItemSection(section)) {
          return;
        }

        const items = itemsOf(section);
        const index = items.findIndex((candidate) => candidate.id === itemId);

        if (index !== -1) {
          items.splice(index, 1);
        }
      });
    },

    moveItem: (sectionId, from, to) => {
      mutate((draft) => {
        const section = sectionById(draft, sectionId);

        if (!section || !isItemSection(section)) {
          return;
        }

        const items = itemsOf(section);
        const moved = moveArrayItem(items, from, to);

        if (moved !== items) {
          items.splice(0, items.length, ...moved);
        }
      });
    },

    setTheme: (patch) => {
      mutate((draft) => {
        assignDefined(draft.theme, patch);
      });
    },

    setPage: (patch) => {
      mutate((draft) => {
        assignDefined(draft.page, patch);
      });
    },

    setTemplateId: (templateId) => {
      mutate((draft) => {
        draft.templateId = templateId;
      });
    },

    replaceDocument: (document) => {
      mutate((draft) => {
        draft.document = document;
      });
    },

    undo: () => {
      step("undo");
    },

    redo: () => {
      step("redo");
    },

    setActiveSectionId: (sectionId) => {
      set({ activeSectionId: sectionId });
    },

    markSaving: () => {
      set({ status: "saving", error: null });
    },

    markSaved: ({ draft, savedAt }) => {
      const state = get();

      set({
        saved: draft,
        savedAt,
        // Edits landed while the request was open: still dirty, and the next
        // autosave will carry them.
        status: Object.is(state.draft, draft) ? "saved" : "dirty",
        error: null,
      });
    },

    markConflict: (message) => {
      set({ status: "conflict", error: message });
    },

    markError: (message) => {
      set({ status: "error", error: message });
    },
  };
});

// ── Selectors ─────────────────────────────────────────────────────────────────
//
// Exported as standalone functions so components pass them straight to the hook
// (`useResumeStore(selectCanUndo)`) and every subscriber narrows to the smallest
// slice it needs. Each returns an existing reference or a primitive — never a fresh
// object — or the default `Object.is` comparison would re-render on every change.

export const selectDraft = (state: ResumeEditorStore): ResumeDraft => state.draft;
export const selectDocument = (state: ResumeEditorStore): ResumeDocument => state.draft.document;
export const selectBasics = (state: ResumeEditorStore): ResumeBasics => state.draft.document.basics;
export const selectSections = (state: ResumeEditorStore): ResumeSection[] =>
  state.draft.document.sections;
export const selectTheme = (state: ResumeEditorStore): ResumeTheme => state.draft.theme;
export const selectPage = (state: ResumeEditorStore): ResumePage => state.draft.page;
export const selectTemplateId = (state: ResumeEditorStore): string => state.draft.templateId;

export const selectIsDirty = (state: ResumeEditorStore): boolean =>
  !Object.is(state.draft, state.saved);
export const selectCanUndo = (state: ResumeEditorStore): boolean => canUndo(state.history);
export const selectCanRedo = (state: ResumeEditorStore): boolean => canRedo(state.history);

/** Curried: `useResumeStore(selectSection(id))`. */
export const selectSection =
  (sectionId: string) =>
  (state: ResumeEditorStore): ResumeSection | undefined =>
    state.draft.document.sections.find((section) => section.id === sectionId);
