/**
 * The rules that decide whether a keyword "appears on the resume".
 *
 * Every case here is a mismatch a user would report as a bug in the score: a term they
 * clearly have counted as missing, or a term they clearly lack counted as present. The
 * substring cases matter most — a naive `includes` would credit "Go" to anyone who
 * mentioned Google, which silently inflates every score in the product.
 */

import { describe, expect, it } from "vitest";

import { includesPhrase, phrasesFor, tokenize } from "./keywords";

function matches(haystack: string, keyword: string): boolean {
  return includesPhrase(tokenize(haystack), tokenize(keyword));
}

describe("tokenize", () => {
  it("splits on punctuation, so CI/CD is two comparable tokens", () => {
    expect(tokenize("CI/CD pipelines")).toEqual(["ci", "cd", "pipeline"]);
  });

  it("keeps the characters that are part of a language's name", () => {
    expect(tokenize("C++, C#, F#")).toEqual(["c++", "c#", "f#"]);
  });

  it("folds dots away, so every spelling of Node.js lands on one token", () => {
    expect(tokenize("Node.js")).toEqual(tokenize("NodeJS"));
    expect(tokenize(".NET")).toEqual(["net"]);
  });

  it("strips diacritics, since a résumé and a resume are the same word", () => {
    expect(tokenize("Café Ops")).toEqual(["cafe", "ops"]);
  });

  it("singularizes long words so APIs matches API", () => {
    expect(tokenize("APIs")).toEqual(tokenize("API"));
    expect(tokenize("pipelines")).toEqual(["pipeline"]);
  });

  it("leaves tokens alone when the stem would land on another term", () => {
    // CS, AW, and IO are all real terms; CSS, AWS, and iOS must not stem onto them.
    expect(tokenize("CSS AWS iOS JS class status")).toEqual([
      "css",
      "aws",
      "ios",
      "js",
      "class",
      "status",
    ]);
  });

  it("drops punctuation-only fragments rather than emitting empty tokens", () => {
    expect(tokenize("--- • ---")).toEqual([]);
  });
});

describe("includesPhrase", () => {
  it("matches a multi-word requirement inside a sentence", () => {
    expect(matches("Built the design system in React Native for iOS", "React Native")).toBe(true);
  });

  it("never matches inside a longer word", () => {
    expect(matches("Deployed on Google Cloud", "Go")).toBe(false);
    expect(matches("Owned internal tooling", "intern")).toBe(false);
  });

  it("requires the words to be adjacent and in order", () => {
    expect(matches("React and, separately, Native modules", "React Native")).toBe(false);
    expect(matches("Native React wrappers", "React Native")).toBe(false);
  });

  it("matches an empty haystack against nothing", () => {
    expect(matches("", "React")).toBe(false);
  });

  it("matches nothing for a keyword that normalizes away", () => {
    // Otherwise a junk requirement would be credited against every resume.
    expect(matches("React, TypeScript", "---")).toBe(false);
  });
});

describe("phrasesFor", () => {
  it("returns the keyword and its aliases, longest phrase first", () => {
    expect(phrasesFor("Kubernetes", ["K8s", "container orchestration"])).toEqual([
      ["container", "orchestration"],
      ["kubernete"],
      ["k8s"],
    ]);
  });

  it("drops an alias that normalizes to the keyword", () => {
    expect(phrasesFor("Node.js", ["NodeJS", "node js"])).toEqual([["node", "js"], ["nodejs"]]);
  });

  it("drops aliases with no usable tokens", () => {
    expect(phrasesFor("React", ["", "  ", "-"])).toEqual([["react"]]);
  });
});
