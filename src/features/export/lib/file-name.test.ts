import { describe, expect, it } from "vitest";

import { exportFileName, exportStoragePath, slugifyFileName } from "./file-name";

/**
 * A resume title is user text, and it reaches two places where characters have meaning:
 * a storage object key whose first segment is what the bucket policies match, and the
 * name the browser writes to disk. So the traversal and injection cases below are the
 * point of this file; the pretty-slug cases are there to prove the allowlist did not
 * over-reach and mangle ordinary titles.
 */

describe("slugifyFileName", () => {
  it.each([
    ["Senior Engineer Resume", "senior-engineer-resume"],
    ["  padded  title  ", "padded-title"],
    ["Résumé — Backend", "resume-backend"],
    ["C++ / Rust Developer", "c-rust-developer"],
    ["multiple---hyphens", "multiple-hyphens"],
  ])("slugifies %j", (title, expected) => {
    expect(slugifyFileName(title)).toBe(expected);
  });

  it.each([
    ["path traversal", "../../etc/passwd"],
    ["absolute path", "/etc/shadow"],
    ["windows path", "C:\\Windows\\System32"],
    ["nul byte", "resume\u0000.pdf"],
    ["quote break-out", 'resume"; rm -rf /'],
    ["newline injection", "resume\nContent-Type: text/html"],
  ])("strips %s to word characters only", (_label, title) => {
    expect(slugifyFileName(title)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each([
    ["empty", ""],
    ["whitespace", "   "],
    ["punctuation only", "!!!"],
    ["emoji only", "🎯🚀"],
    ["cjk only", "履歴書"],
  ])("falls back to a usable name for a %s title", (_label, title) => {
    // A title with nothing the allowlist keeps would otherwise produce ".pdf" — a
    // hidden file on Unix, and a name most browsers refuse to save.
    expect(slugifyFileName(title)).toBe("resume");
  });

  it("caps the length", () => {
    expect(slugifyFileName("word ".repeat(100)).length).toBeLessThanOrEqual(60);
  });

  it("never ends in a hyphen after the cap", () => {
    // The slice can land mid-separator, which would otherwise ship "long-name-.pdf".
    for (let length = 55; length <= 70; length += 1) {
      expect(slugifyFileName("ab ".repeat(length))).not.toMatch(/-$/);
    }
  });
});

describe("exportFileName", () => {
  it.each([
    ["pdf", "my-resume.pdf"],
    ["png", "my-resume.png"],
    ["jpeg", "my-resume.jpg"],
  ] as const)("appends the %s extension", (format, expected) => {
    expect(exportFileName("My Resume", format)).toBe(expected);
  });
});

describe("exportStoragePath", () => {
  const input = {
    userId: "22222222-2222-4222-8222-222222222222",
    resumeId: "11111111-1111-4111-8111-111111111111",
    format: "pdf",
    timestamp: 1_800_000_000_000,
  } as const;

  it("puts the owner in the first path segment", () => {
    // SECURITY: `exports_read_own` / `exports_delete_own` compare
    // `(storage.foldername(name))[1]` to `auth.uid()`. If the owner id stops being the
    // first segment, every object in the bucket becomes unreadable to its owner — or,
    // worse, readable by whoever the first segment now names.
    expect(exportStoragePath(input).split("/")[0]).toBe(input.userId);
  });

  it("builds an owner/resume/timestamp key", () => {
    expect(exportStoragePath(input)).toBe(
      `${input.userId}/${input.resumeId}/${input.timestamp}.pdf`,
    );
  });

  it("does not collide on re-export", () => {
    expect(exportStoragePath(input)).not.toBe(
      exportStoragePath({ ...input, timestamp: input.timestamp + 1 }),
    );
  });

  it("has exactly three segments", () => {
    // No title in the path: a title that slugified to "" or contained a separator would
    // change the segment count, and the policies index by position.
    expect(exportStoragePath(input).split("/")).toHaveLength(3);
  });
});
