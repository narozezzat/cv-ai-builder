import { describe, expect, it } from "vitest";

import { isRichTextEmpty, richTextLength, richTextToPlainText } from "./rich-text";

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
