import { describe, expect, it } from "vitest";

import {
  isRichTextEmpty,
  plainTextToRichText,
  richTextLength,
  richTextToPlainText,
} from "./rich-text";

describe("richTextToPlainText", () => {
  it("strips inline marks", () => {
    expect(richTextToPlainText("<p>Shipped <strong>three</strong> <em>releases</em></p>")).toBe(
      "Shipped three releases",
    );
  });

  it("turns block and list boundaries into newlines", () => {
    expect(richTextToPlainText("<p>Intro</p><ul><li>One</li><li>Two</li></ul>")).toBe(
      "Intro\nOne\nTwo",
    );
  });

  it("turns hard breaks into newlines", () => {
    expect(richTextToPlainText("<p>One<br />Two</p>")).toBe("One\nTwo");
  });

  it("decodes the entities the serializer emits", () => {
    expect(richTextToPlainText("<p>R&amp;D &lt;scale&gt; &quot;fast&quot;</p>")).toBe(
      'R&D <scale> "fast"',
    );
  });

  it("collapses whitespace without collapsing newlines", () => {
    expect(richTextToPlainText("<p>  a   b  </p>\n\n<p>c</p>")).toBe("a b\nc");
  });
});

describe("plainTextToRichText", () => {
  it("wraps a single line in one paragraph", () => {
    expect(plainTextToRichText("Shipped three releases")).toBe("<p>Shipped three releases</p>");
  });

  it("splits blank-line runs into paragraphs", () => {
    expect(plainTextToRichText("One\n\n\nTwo")).toBe("<p>One</p><p>Two</p>");
  });

  it("turns a single newline into a hard break", () => {
    expect(plainTextToRichText("One\nTwo")).toBe("<p>One<br>Two</p>");
  });

  it("normalizes CRLF", () => {
    expect(plainTextToRichText("One\r\n\r\nTwo")).toBe("<p>One</p><p>Two</p>");
  });

  // Security: model output lands in a stored document that a public share page
  // renders, so markup in it must not survive as markup.
  it("escapes markup in the text", () => {
    expect(plainTextToRichText('<script>alert("x")</script>')).toBe(
      '<p>&lt;script&gt;alert("x")&lt;/script&gt;</p>',
    );
  });

  it("escapes ampersands before angle brackets, so an entity is not double-decoded", () => {
    expect(plainTextToRichText("R&D &lt;b&gt;")).toBe("<p>R&amp;D &amp;lt;b&amp;gt;</p>");
  });

  it("round-trips back to the text it was given", () => {
    const text = "R&D <scale>\nsecond line";

    expect(richTextToPlainText(plainTextToRichText(text))).toBe(text);
  });

  it("yields an empty document for blank input", () => {
    expect(plainTextToRichText("")).toBe("<p></p>");
    expect(plainTextToRichText("   \n  \n ")).toBe("<p></p>");
  });
});

describe("isRichTextEmpty", () => {
  it("treats TipTap's empty document as empty", () => {
    expect(isRichTextEmpty("")).toBe(true);
    expect(isRichTextEmpty("<p></p>")).toBe(true);
    expect(isRichTextEmpty("<p><br /></p>")).toBe(true);
    expect(isRichTextEmpty("<p>&nbsp;</p>")).toBe(true);
  });

  it("treats prose as filled in", () => {
    expect(isRichTextEmpty("<p>a</p>")).toBe(false);
  });
});

describe("richTextLength", () => {
  it("counts what the user typed, not the markup around it", () => {
    expect(richTextLength("<p><strong>abc</strong></p>")).toBe(3);
  });
});
