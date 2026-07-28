/**
 * Security tests. `renderRichText` is the only thing between a stored description and a
 * `dangerouslySetInnerHTML` on the public share page, so each case below corresponds to
 * an attack that page would otherwise carry: script execution, `javascript:` hrefs,
 * reverse tabnabbing, and SEO spam parked on our domain.
 */

import { describe, expect, it } from "vitest";

import { renderRichText } from "./render-rich-text";

describe("renderRichText", () => {
  it("passes an empty string through untouched", () => {
    expect(renderRichText("")).toBe("");
  });

  it("keeps the formatting the editor is allowed to produce", () => {
    const html = "<p>Shipped <strong>fast</strong> and <em>often</em></p><ul><li>One</li></ul>";

    expect(renderRichText(html)).toBe(html);
  });

  it("discards script tags and their contents", () => {
    const rendered = renderRichText("<p>Hi</p><script>alert(1)</script>");

    expect(rendered).toBe("<p>Hi</p>");
    expect(rendered).not.toContain("alert");
  });

  it("discards event handlers", () => {
    const rendered = renderRichText('<p onclick="alert(1)">Hi</p>');

    expect(rendered).toBe("<p>Hi</p>");
  });

  it("hardens links against tabnabbing and SEO spam", () => {
    const rendered = renderRichText('<p><a href="https://example.com">Site</a></p>');

    expect(rendered).toContain('href="https://example.com"');
    expect(rendered).toContain('target="_blank"');
    expect(rendered).toContain('rel="noopener noreferrer nofollow ugc"');
  });

  it("drops a javascript: href but keeps the text", () => {
    const rendered = renderRichText('<p><a href="javascript:alert(1)">Click</a></p>');

    expect(rendered).not.toContain("javascript");
    expect(rendered).toContain("Click");
  });

  it("drops protocol-relative and non-http schemes", () => {
    expect(renderRichText('<a href="//evil.example">x</a>')).not.toContain("evil.example");
    expect(renderRichText('<a href="data:text/html,<script>1</script>">x</a>')).not.toContain(
      "data:",
    );
  });

  it("overrides a target and rel the input tried to set itself", () => {
    const rendered = renderRichText(
      '<a href="https://example.com" target="_self" rel="dofollow">x</a>',
    );

    expect(rendered).toContain('target="_blank"');
    expect(rendered).toContain('rel="noopener noreferrer nofollow ugc"');
    expect(rendered).not.toContain("dofollow");
  });

  it("strips styling and structural tags the schema never allows", () => {
    const rendered = renderRichText(
      '<div style="position:fixed"><iframe src="https://evil.example"></iframe><p>Text</p></div>',
    );

    expect(rendered).toBe("<p>Text</p>");
  });
});
