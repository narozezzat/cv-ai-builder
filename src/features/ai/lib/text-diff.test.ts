import { describe, expect, it } from "vitest";

import { diffLines, diffWords, hasDiffChanges } from "./text-diff";

describe("diffWords", () => {
  it("marks identical text as one equal segment", () => {
    expect(diffWords("Shipped the thing", "Shipped the thing")).toEqual([
      { op: "equal", value: "Shipped the thing" },
    ]);
  });

  it("keeps the shared prefix and suffix out of the change", () => {
    expect(diffWords("Cut latency by 20%", "Cut latency by 60%")).toEqual([
      { op: "equal", value: "Cut latency by" },
      { op: "removed", value: "20%" },
      { op: "added", value: "60%" },
    ]);
  });

  it("emits the removal before its replacement", () => {
    const ops = diffWords("old", "new").map((segment) => segment.op);

    expect(ops).toEqual(["removed", "added"]);
  });

  it("merges a run of added words into one segment", () => {
    expect(diffWords("Led team", "Led a large distributed team")).toEqual([
      { op: "equal", value: "Led" },
      { op: "added", value: "a large distributed" },
      { op: "equal", value: "team" },
    ]);
  });

  it("normalizes whitespace", () => {
    expect(diffWords("a   b\n\nc", "a b c")).toEqual([{ op: "equal", value: "a b c" }]);
  });

  it("handles an empty side", () => {
    expect(diffWords("", "brand new")).toEqual([{ op: "added", value: "brand new" }]);
    expect(diffWords("was here", "")).toEqual([{ op: "removed", value: "was here" }]);
    expect(diffWords("", "")).toEqual([]);
  });

  it("degrades to a whole-block replacement past the token cap", () => {
    const before = Array.from({ length: 1201 }, (_, index) => `a${index}`).join(" ");
    const after = "short";

    expect(diffWords(before, after)).toEqual([
      { op: "removed", value: before },
      { op: "added", value: "short" },
    ]);
  });
});

describe("diffLines", () => {
  it("keeps one segment per line rather than merging runs", () => {
    // Merged, two added bullets would render inside one row.
    expect(diffLines(["kept"], ["kept", "first new", "second new"])).toEqual([
      { op: "equal", value: "kept" },
      { op: "added", value: "first new" },
      { op: "added", value: "second new" },
    ]);
  });

  it("reports a rewritten line as a removal and an addition", () => {
    expect(diffLines(["Managed the backlog"], ["Owned the roadmap"])).toEqual([
      { op: "removed", value: "Managed the backlog" },
      { op: "added", value: "Owned the roadmap" },
    ]);
  });

  it("detects a reorder as one line moving", () => {
    const ops = diffLines(["a", "b", "c"], ["b", "c", "a"]);

    expect(ops).toEqual([
      { op: "removed", value: "a" },
      { op: "equal", value: "b" },
      { op: "equal", value: "c" },
      { op: "added", value: "a" },
    ]);
  });

  it("drops blank lines from both sides", () => {
    expect(diffLines(["a", "  ", ""], ["a"])).toEqual([{ op: "equal", value: "a" }]);
  });
});

describe("hasDiffChanges", () => {
  it("is false when the suggestion matches what is already there", () => {
    expect(hasDiffChanges(diffWords("same text", "same text"))).toBe(false);
  });

  it("is true for any addition or removal", () => {
    expect(hasDiffChanges(diffWords("a", "b"))).toBe(true);
  });
});
