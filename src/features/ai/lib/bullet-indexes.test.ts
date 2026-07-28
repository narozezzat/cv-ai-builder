import { describe, expect, it } from "vitest";

import { reconcileBulletIndexes } from "./bullet-indexes";

describe("reconcileBulletIndexes", () => {
  it("keeps every index that was sent", () => {
    const result = reconcileBulletIndexes(
      [
        { index: 0, text: "Shipped the thing" },
        { index: 2, text: "Cut latency in half" },
      ],
      3,
    );

    expect(result).toEqual([
      { index: 0, text: "Shipped the thing" },
      { index: 2, text: "Cut latency in half" },
    ]);
  });

  it("drops an index past the end of the request", () => {
    // The caller applies by index, so an out-of-range echo would write into a bullet
    // the user never submitted.
    const result = reconcileBulletIndexes(
      [
        { index: 0, text: "kept" },
        { index: 4, text: "invented" },
      ],
      2,
    );

    expect(result).toEqual([{ index: 0, text: "kept" }]);
  });

  it("drops a negative index", () => {
    expect(reconcileBulletIndexes([{ index: -1, text: "nope" }], 3)).toEqual([]);
  });

  it("drops a non-integer index", () => {
    expect(reconcileBulletIndexes([{ index: 1.5, text: "nope" }], 3)).toEqual([]);
  });

  it("keeps the first answer when an index repeats", () => {
    const result = reconcileBulletIndexes(
      [
        { index: 1, text: "first" },
        { index: 1, text: "second" },
      ],
      3,
    );

    expect(result).toEqual([{ index: 1, text: "first" }]);
  });

  it("sorts ascending regardless of the order the model emitted", () => {
    const result = reconcileBulletIndexes(
      [
        { index: 2, text: "c" },
        { index: 0, text: "a" },
        { index: 1, text: "b" },
      ],
      3,
    );

    expect(result.map((item) => item.index)).toEqual([0, 1, 2]);
  });

  it("returns nothing when no bullets were sent", () => {
    expect(reconcileBulletIndexes([{ index: 0, text: "nope" }], 0)).toEqual([]);
  });

  it("does not mutate the input", () => {
    const items = [
      { index: 1, text: "b" },
      { index: 0, text: "a" },
    ];

    reconcileBulletIndexes(items, 2);

    expect(items.map((item) => item.index)).toEqual([1, 0]);
  });
});
