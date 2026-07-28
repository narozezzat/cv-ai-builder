/**
 * Security tests. Every case here is an attack that reaches the database if the
 * sanitizer is loosened, because the same stored HTML is re-rendered into the
 * editor, into the PDF, and onto the public `/r/[slug]` share page.
 */

import { describe, expect, it } from "vitest";

import { sanitizeRichText } from "./sanitize-rich-text";

describe("sanitizeRichText", () => {
  it("keeps the tags the editor can produce", () => {
    const html =
      "<p>Shipped <strong>three</strong> <em>releases</em></p><ul><li>One<br />Two</li></ul>";

    expect(sanitizeRichText(html)).toBe(html);
  });

  it("keeps an http(s) link with only its href", () => {
    expect(sanitizeRichText('<p><a href="https://example.com/a?b=c">docs</a></p>')).toBe(
      '<p><a href="https://example.com/a?b=c">docs</a></p>',
    );
  });

  it("drops a script element and its contents", () => {
    expect(sanitizeRichText("<p>hi</p><script>alert(document.cookie)</script>")).toBe("<p>hi</p>");
  });

  it("drops event handler attributes", () => {
    expect(sanitizeRichText('<p onmouseover="steal()">hover</p>')).toBe("<p>hover</p>");
    expect(sanitizeRichText('<img src="x" onerror="steal()" />')).toBe("");
  });

  it("unlinks a javascript: href but keeps the text", () => {
    expect(sanitizeRichText('<p><a href="javascript:alert(1)">click</a></p>')).toBe("<p>click</p>");
  });

  it("unlinks obfuscated and data hrefs", () => {
    expect(sanitizeRichText('<p><a href="jAvAsCrIpT:alert(1)">x</a></p>')).toBe("<p>x</p>");
    expect(sanitizeRichText('<p><a href="data:text/html;base64,PHNjcmlwdD4=">x</a></p>')).toBe(
      "<p>x</p>",
    );
  });

  it("unlinks protocol-relative and relative hrefs", () => {
    expect(sanitizeRichText('<p><a href="//evil.example">x</a></p>')).toBe("<p>x</p>");
    expect(sanitizeRichText('<p><a href="/settings/billing">x</a></p>')).toBe("<p>x</p>");
    expect(sanitizeRichText('<p><a href="?next=/admin">x</a></p>')).toBe("<p>x</p>");
  });

  it("drops iframes, objects, and forms", () => {
    expect(sanitizeRichText('<iframe src="https://evil.example"></iframe><p>a</p>')).toBe(
      "<p>a</p>",
    );
    expect(sanitizeRichText('<form action="/x"><input name="p" /></form>')).toBe("");
  });

  it("drops style attributes and style elements", () => {
    expect(sanitizeRichText('<p style="position:fixed;inset:0">a</p>')).toBe("<p>a</p>");
    expect(sanitizeRichText("<style>p{display:none}</style><p>a</p>")).toBe("<p>a</p>");
  });

  it("unwraps tags outside the allowlist without losing their text", () => {
    expect(sanitizeRichText("<div><h1>Title</h1><p>body</p></div>")).toBe("Title<p>body</p>");
  });

  it("never grows a value, so a near-limit field stays saveable", () => {
    const html = '<p><a href="https://example.com">example</a></p>';

    expect(sanitizeRichText(html).length).toBeLessThanOrEqual(html.length);
  });

  it("passes the empty string straight through", () => {
    expect(sanitizeRichText("")).toBe("");
  });
});
