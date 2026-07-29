import { describe, expect, it } from "vitest";

import { RESUME_LIMITS } from "@/types/resume";

import { MAX_IMPROVE_BULLETS, applyImprovedBullets, bulletsForRequest } from "./improve-bullets";

describe("bulletsForRequest", () => {
  it("trims each bullet and drops the blank rows", () => {
    expect(bulletsForRequest(["  Shipped the thing  ", "", "   ", "Cut latency"])).toEqual([
      "Shipped the thing",
      "Cut latency",
    ]);
  });

  it("caps the request at twelve bullets", () => {
    const highlights = Array.from({ length: 20 }, (_, index) => `Bullet ${index}`);
    const sent = bulletsForRequest(highlights);

    expect(sent).toHaveLength(MAX_IMPROVE_BULLETS);
    expect(sent.at(-1)).toBe("Bullet 11");
  });

  it("counts the cap in non-blank bullets, not array positions", () => {
    // Twelve real bullets separated by blanks: all twelve are sendable even though they
    // span twenty-four positions.
    const highlights = Array.from({ length: 12 }, (_, index) => [`Bullet ${index}`, ""]).flat();

    expect(bulletsForRequest(highlights)).toHaveLength(MAX_IMPROVE_BULLETS);
  });

  it("truncates a bullet to what the schema accepts rather than dropping it", () => {
    const long = "x".repeat(RESUME_LIMITS.highlightText + 50);

    expect(bulletsForRequest([long])[0]).toHaveLength(RESUME_LIMITS.highlightText);
  });
});

describe("applyImprovedBullets", () => {
  it("writes each response index to the bullet that was actually sent", () => {
    // Request order is [Alpha, Beta]; document order is [Alpha, "", Beta]. Applying
    // index 1 positionally would overwrite the blank row and leave Beta untouched.
    const next = applyImprovedBullets(
      ["Alpha", "", "Beta"],
      [{ index: 1, text: "Beta, sharpened" }],
    );

    expect(next).toEqual(["Alpha", "", "Beta, sharpened"]);
  });

  it("keeps the bullets the model chose not to rewrite", () => {
    const next = applyImprovedBullets(
      ["Alpha", "Beta", "Gamma"],
      [{ index: 2, text: "Gamma, sharpened" }],
    );

    expect(next).toEqual(["Alpha", "Beta", "Gamma, sharpened"]);
  });

  it("preserves bullets beyond the twelve the request carried", () => {
    const highlights = Array.from({ length: 14 }, (_, index) => `Bullet ${index}`);
    const next = applyImprovedBullets(highlights, [{ index: 0, text: "Bullet 0, sharpened" }]);

    expect(next[0]).toBe("Bullet 0, sharpened");
    expect(next.slice(12)).toEqual(["Bullet 12", "Bullet 13"]);
    expect(next).toHaveLength(14);
  });

  it("ignores an index past the end of the request", () => {
    const next = applyImprovedBullets(["Alpha", "", "Beta"], [{ index: 5, text: "Invented" }]);

    expect(next).toEqual(["Alpha", "", "Beta"]);
  });

  it("returns a new array rather than mutating the field's", () => {
    const highlights = ["Alpha"];
    const next = applyImprovedBullets(highlights, [{ index: 0, text: "Alpha, sharpened" }]);

    expect(highlights).toEqual(["Alpha"]);
    expect(next).not.toBe(highlights);
  });
});
