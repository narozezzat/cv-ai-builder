/**
 * The last thing that touches rich-text HTML before it becomes a `__html` string.
 *
 * `sanitizeRichText` is deliberately subtractive — it cannot add `rel` or `target`
 * without pushing a field that is already near its Zod ceiling over it (see its
 * header). So the additive half of link safety lives here, at render time, where the
 * output is thrown away after paint and no length limit applies.
 *
 * Runs the subtractive pass first even though stored values have already been through
 * it on the way in. That is not paranoia about our own database; it is what makes this
 * function the *only* thing a renderer needs to trust. The same call serves the live
 * preview (value straight out of the editor's store), the print route (value straight
 * out of Postgres), and the public share page (value straight out of Postgres, rendered
 * for strangers). One code path, so none of the three can be the one that forgot.
 *
 * `nofollow ugc` matters on the share page specifically: those links are user-generated
 * content on our domain, and without it a public resume is a place to park SEO spam.
 */

import sanitizeHtml from "sanitize-html";

import { RICH_TEXT_ALLOWED_TAGS } from "./rich-text";
import { sanitizeRichText } from "./sanitize-rich-text";

const LINK_REL = "noopener noreferrer nofollow ugc";

const HARDEN: sanitizeHtml.IOptions = {
  allowedTags: [...RICH_TEXT_ALLOWED_TAGS],
  // `target` and `rel` are allowed here and nowhere else in the pipeline, because this
  // is the pass that writes them.
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https"],
  allowedSchemesByTag: {},
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  nonTextTags: ["script", "style", "textarea", "option", "noscript"],
  enforceHtmlBoundary: false,
  transformTags: {
    // `true` merges rather than replaces, so the href the first pass validated survives.
    // An anchor that reaches here without a usable href keeps the attributes and loses
    // the href to `allowedSchemes` above — a dead but harmless link.
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: LINK_REL }, true),
  },
};

export function renderRichText(html: string): string {
  if (html.length === 0) {
    return html;
  }

  return sanitizeHtml(sanitizeRichText(html), HARDEN);
}
