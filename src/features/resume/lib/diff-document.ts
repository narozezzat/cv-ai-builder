/**
 * What changed between two versions of a document.
 *
 * Written by hand rather than pulled from a diff library because the useful unit here
 * is not a line of JSON — it is "Experience — Acme · Position changed". A textual diff
 * of two serialized documents would report key reordering, `id` fields, and schema
 * defaults as changes, none of which the user wrote.
 *
 * Identity comes from ids, never from position: sections and items are matched by
 * `id`, so reordering a list is not a change to every row after the one that moved.
 * A row whose id exists on one side only is an add or a remove.
 *
 * Rich text is compared as plain text. A change that only wraps a word in `<strong>`
 * therefore does not appear — deliberately, because the entry it would produce shows
 * before and after text that read identically, which is worse than silence.
 *
 * Pure and isomorphic: the restore dialog computes the diff in the browser, and the
 * snapshot action uses `isSameDocument` to avoid storing a version identical to the
 * newest one it already has.
 */

import {
  type ResumeBasics,
  type ResumeDocument,
  type ResumeSection,
  type ResumeSectionItem,
  SECTION_KIND_LABELS,
  isItemSection,
} from "@/types/resume";
import { richTextToPlainText } from "@/utils/rich-text";

export type DiffKind = "added" | "removed" | "changed";

export interface DiffEntry {
  /** Stable across renders and readable in test failures: `item:<id>.company`. */
  key: string;
  /** Where the change lives — "Basics", "Experience", "Experience — Acme". */
  group: string;
  /** What changed inside that group — "Email", "Highlights", the item's own name. */
  label: string;
  kind: DiffKind;
  /** Empty when `kind` is `added`. */
  before: string;
  /** Empty when `kind` is `removed`. */
  after: string;
}

export interface DocumentDiff {
  entries: DiffEntry[];
  added: number;
  removed: number;
  changed: number;
}

/** One comparable leaf: a field of the document reduced to a displayable string. */
interface Leaf {
  group: string;
  label: string;
  value: string;
}

/**
 * Field names the humanizer gets wrong or renders too tersely.
 *
 * Everything absent from this map falls through to `humanize`, so a field added to
 * the document schema shows up in the diff with a sensible label without touching
 * this file — a diff that silently omits a new field is worse than one that labels
 * it imperfectly.
 */
const FIELD_LABELS: Record<string, string> = {
  area: "Field of study",
  credentialId: "Credential ID",
  current: "Ongoing",
  employmentType: "Employment type",
  expiryDate: "Expires",
  fullName: "Full name",
  issueDate: "Issued",
  keywords: "Keywords",
  releaseDate: "Released",
  repoUrl: "Repository",
  summary: "Description",
  technologies: "Technologies",
  url: "Link",
  visible: "Shown on the resume",
};

/** `startDate` → "Start date". */
function humanize(field: string): string {
  const spaced = field.replace(/([A-Z])/g, " $1").toLowerCase();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? humanize(field);
}

/**
 * A field's value as the diff shows it.
 *
 * `null`/`undefined` collapse to the empty string so that "field absent" and "field
 * blank" are one state — the document schema defaults every optional string to `""`,
 * so treating them differently would report a change on documents that only differ
 * by which schema version parsed them.
 */
function displayValue(field: string, value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    // The separator is only ever displayed, so a bullet reads better than a comma
    // for highlights, which are sentences and contain commas of their own.
    return value.map((entry) => displayValue(field, entry)).join(" • ");
  }

  if (typeof value !== "string") {
    return "";
  }

  return isRichTextField(field) ? richTextToPlainText(value) : value.trim();
}

/** The three fields the editor renders with TipTap. */
function isRichTextField(field: string): boolean {
  return field === "summary" || field === "description" || field === "content";
}

/** Fields that identify a row rather than describe it — never worth an entry. */
const SKIPPED_FIELDS = new Set(["id", "kind", "items", "version"]);

/**
 * How an item names itself in the diff, e.g. "Acme" or "BSc Computer Science".
 *
 * Falls back to the item's id so that an item with every descriptive field blank is
 * still distinguishable from its neighbours instead of collapsing into "Untitled".
 */
function itemHeadline(item: ResumeSectionItem): string {
  const record = item as Record<string, unknown>;

  for (const field of ["company", "position", "name", "title", "institution", "degree", "issuer"]) {
    const value = record[field];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return `Untitled (${item.id.slice(0, 8)})`;
}

/** A section's name in the diff: the user's own title, or the kind's label. */
function sectionHeadline(section: ResumeSection): string {
  return section.title.trim().length > 0 ? section.title.trim() : SECTION_KIND_LABELS[section.kind];
}

function flattenBasics(basics: ResumeBasics, into: Map<string, Leaf>): void {
  const group = "Basics";

  for (const [field, value] of Object.entries(basics)) {
    if (field === "socials" || field === "photo") {
      continue;
    }

    into.set(`basics.${field}`, {
      group,
      label: fieldLabel(field),
      value: displayValue(field, value),
    });
  }

  for (const [field, value] of Object.entries(basics.photo)) {
    into.set(`basics.photo.${field}`, {
      group: "Photo",
      label: fieldLabel(field),
      value: displayValue(field, value),
    });
  }

  for (const social of basics.socials) {
    // Keyed by id, so renaming a network in place reads as one change rather than
    // as a removal plus an unrelated addition.
    const headline = social.network.trim() || social.username.trim() || "Link";

    into.set(`social:${social.id}`, { group: "Links", label: headline, value: headline });

    for (const [field, value] of Object.entries(social)) {
      if (SKIPPED_FIELDS.has(field)) {
        continue;
      }

      into.set(`social:${social.id}.${field}`, {
        group: `Links — ${headline}`,
        label: fieldLabel(field),
        value: displayValue(field, value),
      });
    }
  }
}

function flattenSections(sections: ResumeSection[], into: Map<string, Leaf>): void {
  for (const section of sections) {
    const group = sectionHeadline(section);

    // The row marker carries the section's name only. Fields it could change —
    // title, visibility, content — are leaves of their own, so renaming a section
    // is one entry rather than one for the rename and one for the row it renamed.
    into.set(`section:${section.id}`, {
      group,
      label: SECTION_KIND_LABELS[section.kind],
      value: group,
    });

    into.set(`section:${section.id}.title`, { group, label: "Title", value: section.title.trim() });
    into.set(`section:${section.id}.visible`, {
      group,
      label: fieldLabel("visible"),
      value: displayValue("visible", section.visible),
    });

    if (!isItemSection(section)) {
      into.set(`section:${section.id}.content`, {
        group,
        label: "Content",
        value: displayValue("content", section.content),
      });

      continue;
    }

    for (const item of section.items) {
      const itemGroup = `${group} — ${itemHeadline(item)}`;

      into.set(`item:${item.id}`, { group, label: itemHeadline(item), value: itemHeadline(item) });

      for (const [field, value] of Object.entries(item)) {
        if (SKIPPED_FIELDS.has(field)) {
          continue;
        }

        into.set(`item:${item.id}.${field}`, {
          group: itemGroup,
          label: fieldLabel(field),
          value: displayValue(field, value),
        });
      }
    }
  }
}

function flatten(document: ResumeDocument): Map<string, Leaf> {
  const leaves = new Map<string, Leaf>();

  flattenBasics(document.basics, leaves);
  flattenSections(document.sections, leaves);

  return leaves;
}

/**
 * Whether a leaf belongs to a row (section or item) that exists on one side only.
 *
 * Those rows get one entry for the row itself — "Acme was added" — instead of one
 * entry per field, which for a full experience item would be eleven near-identical
 * lines saying the same thing.
 */
function isRowKey(key: string): boolean {
  return /^(section|item|social):[^.]+$/.test(key);
}

function rowKeyOf(key: string): string {
  const [prefix, rest] = key.split(":", 2);

  if (rest === undefined) {
    return key;
  }

  return `${prefix}:${rest.split(".")[0]}`;
}

/**
 * Every change from `before` to `after`, in document order.
 *
 * `before` is the older document (the stored version), `after` the newer one (what
 * is open in the editor) — so restoring a version applies the *reverse* of this diff.
 * The dialog labels the columns accordingly; getting the direction backwards here
 * would tell the user a field is about to gain text it is about to lose.
 */
export function diffResumeDocuments(before: ResumeDocument, after: ResumeDocument): DocumentDiff {
  const left = flatten(before);
  const right = flatten(after);

  const entries: DiffEntry[] = [];
  let added = 0;
  let removed = 0;
  let changed = 0;

  const push = (key: string, leaf: Leaf, kind: DiffKind, beforeText: string, afterText: string) => {
    entries.push({
      key,
      group: leaf.group,
      label: leaf.label,
      kind,
      before: beforeText,
      after: afterText,
    });

    if (kind === "added") {
      added += 1;
    } else if (kind === "removed") {
      removed += 1;
    } else {
      changed += 1;
    }
  };

  // Additions and changes, walked over `after` so the order matches the editor.
  for (const [key, leaf] of right) {
    const previous = left.get(key);
    const rowMissing = !left.has(rowKeyOf(key));

    if (previous === undefined) {
      // A field of a wholly new row is covered by that row's own entry.
      if (rowMissing && !isRowKey(key)) {
        continue;
      }

      if (leaf.value.length > 0) {
        push(key, leaf, "added", "", leaf.value);
      }

      continue;
    }

    // A row that exists on both sides says nothing on its own — whatever changed
    // inside it is a leaf, and the row marker's own text is one of those leaves.
    if (isRowKey(key) || previous.value === leaf.value) {
      continue;
    }

    if (leaf.value.length === 0) {
      push(key, leaf, "removed", previous.value, "");
    } else if (previous.value.length === 0) {
      push(key, leaf, "added", "", leaf.value);
    } else {
      push(key, leaf, "changed", previous.value, leaf.value);
    }
  }

  // Removals: rows and fields present in `before` and gone from `after`.
  for (const [key, leaf] of left) {
    if (right.has(key)) {
      continue;
    }

    if (!right.has(rowKeyOf(key)) && !isRowKey(key)) {
      continue;
    }

    if (leaf.value.length > 0) {
      push(key, leaf, "removed", leaf.value, "");
    }
  }

  return { entries, added, removed, changed };
}

/**
 * Structural equality, used to avoid storing a snapshot identical to the newest one.
 *
 * Compares the parsed documents rather than their JSON text: `content` comes back
 * from Postgres as `jsonb`, which reorders object keys, so `JSON.stringify` on both
 * sides would report a difference between a document and itself.
 */
export function isSameDocument(left: ResumeDocument, right: ResumeDocument): boolean {
  return deepEqual(left, right);
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }

    return left.every((entry, index) => deepEqual(entry, right[index]));
  }

  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every(
    (key) =>
      Object.hasOwn(right, key) &&
      deepEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
  );
}
