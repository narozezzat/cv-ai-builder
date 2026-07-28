/**
 * The schema is a security boundary, not a styling choice: everything it admits is
 * stored HTML that twenty templates render, Puppeteer prints, and the public share
 * page serves. These tests drive a headless `Editor` — no React, no jsdom-specific
 * editor chrome — so the allowlist, the length cap, and the link gate are asserted
 * against the real ProseMirror schema rather than against the toolbar.
 */

import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { richTextExtensions } from "./rich-text-extensions";

let editor: Editor | undefined;

function createEditor(maxLength = 1_000, content = ""): Editor {
  editor = new Editor({
    element: document.createElement("div"),
    extensions: richTextExtensions({ maxLength }),
    content,
  });

  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

describe("richTextExtensions", () => {
  describe("schema allowlist", () => {
    it("keeps the six marks and nodes a resume needs", () => {
      const instance = createEditor(
        1_000,
        "<p>Led <strong>growth</strong> and <em>retention</em></p><ul><li>Shipped</li></ul>",
      );

      // `<li>` wraps its content in a paragraph — TipTap's ListItem takes block
      // content, not inline. Asserted rather than normalized away, because the
      // sanitizer's allowlist and the templates' CSS both have to expect that `<p>`.
      expect(instance.getHTML()).toBe(
        "<p>Led <strong>growth</strong> and <em>retention</em></p><ul><li><p>Shipped</p></li></ul>",
      );
    });

    it("drops everything outside the allowlist instead of rendering it", () => {
      const instance = createEditor(
        2_000,
        "<h1>Title</h1><blockquote>Quote</blockquote><pre><code>code</code></pre>" +
          '<table><tbody><tr><td>cell</td></tr></tbody></table><img src="x.png" alt="" />' +
          "<p>Kept</p>",
      );

      const html = instance.getHTML();

      for (const tag of ["<h1", "<blockquote", "<pre", "<code", "<table", "<img"]) {
        expect(html).not.toContain(tag);
      }

      // Text survives the unwrap — a pasted heading becomes a paragraph, not a hole.
      expect(instance.getText()).toContain("Title");
      expect(html).toContain("<p>Kept</p>");
    });

    it("strips attributes the sanitizer would remove anyway", () => {
      const html = createEditor(
        1_000,
        '<p class="promo" style="position:fixed" onclick="steal()">Text</p>',
      ).getHTML();

      expect(html).toBe("<p>Text</p>");
    });
  });

  describe("link gate", () => {
    it("accepts an absolute http(s) address", () => {
      const instance = createEditor(1_000, "<p>Portfolio</p>");
      instance.commands.selectAll();

      expect(instance.commands.setLink({ href: "https://example.com/work" })).toBe(true);
      expect(instance.getHTML()).toContain('href="https://example.com/work"');
    });

    it.each(["javascript:alert(1)", "data:text/html;base64,PHNjcmlwdD4=", "vbscript:msgbox"])(
      "refuses the script-bearing scheme %s",
      (href) => {
        const instance = createEditor(1_000, "<p>Portfolio</p>");
        instance.commands.selectAll();
        instance.commands.setLink({ href });

        expect(instance.getHTML()).not.toContain("href");
      },
    );

    it("refuses a relative href, which on the share page points back into our app", () => {
      const instance = createEditor(1_000, "<p>Portfolio</p>");
      instance.commands.selectAll();
      instance.commands.setLink({ href: "/admin" });

      expect(instance.getHTML()).not.toContain("href");
    });

    it("does not autolink an unsafe scheme typed into the field", () => {
      const instance = createEditor(1_000);
      instance.commands.insertContent("javascript:alert(1) ");

      expect(instance.getHTML()).not.toContain("<a");
    });
  });

  // `filterTransaction` drops the transaction inside `dispatch`, after the command
  // has already reported that it applied — so every assertion here reads the
  // resulting document, never the command's return value.
  describe("html length cap", () => {
    /** `<p></p>` is 7 characters, so 27 leaves room for exactly 20 of text. */
    const FULL = "<p>12345678901234567890</p>";

    it("rejects the edit that would cross the bound", () => {
      const instance = createEditor(27, FULL);
      instance.commands.insertContent("!");

      expect(instance.getHTML()).toBe(FULL);
    });

    it("counts markup, not text, because markup is what the Zod bound measures", () => {
      const instance = createEditor(27, FULL);
      instance.commands.selectAll();

      // Bolding adds no text and 17 characters of HTML. A text-only cap would let
      // this through and the save would then fail against a limit nobody saw.
      instance.commands.toggleBold();

      expect(instance.getHTML()).toBe(FULL);
    });

    it("truncates nothing and blocks the whole paste rather than half of it", () => {
      const instance = createEditor(40, "<p>Short</p>");
      instance.commands.focus("end");
      instance.commands.insertContent(`<p>${"x".repeat(200)}</p>`);

      // All or nothing: a partially applied paste is worse than a refused one,
      // because the user cannot see where it stopped.
      expect(instance.getHTML()).toBe("<p>Short</p>");
    });

    it("allows edits that keep the document inside the bound", () => {
      const instance = createEditor(40, "<p>Short</p>");
      instance.commands.focus("end");
      instance.commands.insertContent("er");

      expect(instance.getHTML()).toBe("<p>Shorter</p>");
    });

    it("permits selection and deletion at the ceiling, so a full field is not stuck", () => {
      const instance = createEditor(27, FULL);

      // Selection transactions do not change the doc, so the cap must ignore them —
      // otherwise a full field cannot be navigated, only deleted from.
      instance.commands.setTextSelection({ from: 1, to: 5 });
      expect(instance.state.selection.empty).toBe(false);

      // …and deleting is always allowed, which is the way back under the limit.
      instance.commands.deleteSelection();
      expect(instance.getHTML()).toBe("<p>5678901234567890</p>");
    });
  });
});
