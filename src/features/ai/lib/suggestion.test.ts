import { describe, expect, it } from "vitest";

import { mergeListItems } from "./suggestion";

const limits = { maxItems: 4, maxLength: 10 };

describe("mergeListItems", () => {
  it("appends after what is already there", () => {
    expect(mergeListItems(["React"], ["Node"], limits)).toEqual(["React", "Node"]);
  });

  it("drops a case-insensitive duplicate of an existing item", () => {
    expect(mergeListItems(["React"], ["react", "Node"], limits)).toEqual(["React", "Node"]);
  });

  it("drops duplicates inside the additions", () => {
    expect(mergeListItems([], ["Node", "node"], limits)).toEqual(["Node"]);
  });

  it("stops at the item cap", () => {
    expect(mergeListItems(["a", "b"], ["c", "d", "e"], limits)).toEqual(["a", "b", "c", "d"]);
  });

  it("truncates an item past the length cap", () => {
    // Over the limit it would fail document validation at save time, long after the
    // click that added it.
    expect(mergeListItems([], ["abcdefghijkl"], limits)).toEqual(["abcdefghij"]);
  });

  it("trims and skips blank additions", () => {
    expect(mergeListItems([], ["  Node  ", "   "], limits)).toEqual(["Node"]);
  });

  it("does not mutate the current list", () => {
    const current = ["a"];

    mergeListItems(current, ["b"], limits);

    expect(current).toEqual(["a"]);
  });
});
