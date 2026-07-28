/**
 * The canonical control on rich-text HTML.
 *
 * The editor locks its ProseMirror schema to the same tag set, but that is a
 * client-side convenience: the save action takes JSON from the network, so
 * anything the browser enforces is advice. This runs on every rich-text field on
 * the way in, and its output is what gets stored, re-rendered into the editor,
 * printed by Puppeteer, and served on the public share page.
 *
 * Server-side by convention, not by `import "server-only"` — that module throws
 * under Vitest's default resolve conditions, and a sanitizer without unit tests
 * is worse than one a client component could theoretically import.
 *
 * Deliberately purely subtractive. It removes tags, attributes, and hrefs; it
 * never adds any. Appending `rel="noopener noreferrer"` here would grow the value
 * by 30 characters, which for a field sitting near `RESUME_LIMITS.itemRichText`
 * turns a legitimate save into a validation failure. Link hardening is therefore
 * a render-time concern — see the renderer, which applies it to every `<a>`.
 */

import sanitizeHtml from "sanitize-html";

import { isSafeHttpUrl } from "@/types/resume";
import { RICH_TEXT_ALLOWED_TAGS } from "@/utils/rich-text";

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...RICH_TEXT_ALLOWED_TAGS],
  // `href` only. No `target`, no `rel`, no `class`, and no `style` anywhere —
  // `style` is an injection surface (`background: url(...)`, `position: fixed`
  // over the print layout) with no editing feature behind it.
  allowedAttributes: { a: ["href"] },
  allowedSchemes: ["http", "https"],
  // `mailto:` and `tel:` belong on the contact fields, which are typed and
  // validated. A link in prose has no reason to leave the web.
  allowedSchemesByTag: {},
  allowProtocolRelative: false,
  // Drop disallowed tags entirely rather than escaping them into visible text:
  // a pasted `<div>` should vanish, not print as `&lt;div&gt;` on the resume.
  disallowedTagsMode: "discard",
  // Defaults, restated because they are the security-relevant ones: the *content*
  // of a script or style element is discarded along with the element.
  nonTextTags: ["script", "style", "textarea", "option", "noscript"],
  enforceHtmlBoundary: false,
  transformTags: {
    // Return type stated: without it TS infers the `span` branch's empty `attribs`
    // as `{ href?: undefined }`, which does not satisfy `Attributes`.
    a: (tagName, attribs): sanitizeHtml.Tag => {
      const href = attribs.href;

      // sanitize-html's scheme filter passes anything without a scheme, so
      // `/admin`, `//evil.com`, and `?x=1` survive it. On a public share page a
      // relative href is a link into our own app wearing the user's words, so the
      // same absolute-http test the editor uses decides it here too.
      if (typeof href === "string" && isSafeHttpUrl(href)) {
        return { tagName, attribs: { href } };
      }

      // Keep the anchor's text, lose the link.
      return { tagName: "span", attribs: {} };
    },
  },
  // `span` exists only as the landing spot for a stripped anchor above; it is not
  // in `allowedTags`, so `disallowedTagsMode: "discard"` unwraps it immediately
  // and the text survives without the element.
};

export function sanitizeRichText(html: string): string {
  if (html.length === 0) return html;

  return sanitizeHtml(html, OPTIONS);
}
