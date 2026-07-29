/**
 * Rich-text helpers that hold no dependency on TipTap or the sanitizer.
 *
 * The editor stores HTML, but several consumers need something else from it: the
 * character counter needs a length the user recognizes (they typed 40 characters,
 * not 53 including `<strong>`), the empty-state checks need to know that
 * `<p></p>` is an empty document, and the ATS scorer and AI prompts need prose.
 * All three are the same question — what did the user actually write — so it is
 * answered once, here, in a module both the client and the server can import.
 */

/**
 * The complete tag allowlist, shared by the editor's schema and the server
 * sanitizer so the two cannot drift. Anything outside this list is markup the
 * document is not allowed to contain, no matter which end produced it.
 */
export const RICH_TEXT_ALLOWED_TAGS = ["p", "br", "strong", "em", "ul", "li", "a"] as const;

/** Entities TipTap's serializer actually emits. Not a general HTML decoder. */
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/**
 * The prose inside `html`, with block boundaries turned into newlines.
 *
 * Tag-stripping by regex, which is the wrong tool for parsing untrusted HTML and
 * the right one here: the output is never re-inserted into a document, only
 * counted, compared to `""`, or handed to an AI prompt as text. It must not be
 * used to decide that a value is safe to render.
 */
export function richTextToPlainText(html: string): string {
  const withBreaks = html
    // `</li>` before `</ul>` so a list does not collect a trailing blank line.
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|ul|h[1-6]|div|blockquote)\s*>/gi, "\n");

  const withoutTags = withBreaks.replace(/<[^>]*>/g, "");

  const decoded = withoutTags.replace(
    /&(?:amp|lt|gt|quot|nbsp|#39);/gi,
    (entity) => ENTITIES[entity.toLowerCase()] ?? entity,
  );

  return (
    decoded
      // Collapse runs of spaces and tabs, but keep the newlines just inserted.
      .replace(/[^\S\n]+/g, " ")
      .replace(/ *\n[ \n]*/g, "\n")
      .trim()
  );
}

/**
 * Wraps plain text as the minimal rich-text document that holds it.
 *
 * Every AI capability answers in plain text (see the output rules in the prompt
 * layer), but the fields those answers land in store HTML. Concatenating the text
 * into `<p>…</p>` unescaped would let a model — or the pasted job description that
 * influenced it — inject markup into a stored document that is later rendered on a
 * public share page, so `&`, `<`, and `>` are escaped here rather than trusted to
 * the sanitizer downstream. Quotes are left alone: the output is element content,
 * never an attribute value.
 *
 * Blank-line runs separate paragraphs; a single newline inside one becomes `<br>`,
 * which is what TipTap itself emits for a soft break. Empty input yields `<p></p>` —
 * the serialization of an empty document, so `isRichTextEmpty` still agrees.
 */
export function plainTextToRichText(text: string): string {
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  if (paragraphs.length === 0) {
    return "<p></p>";
  }

  return paragraphs
    .map((paragraph) => `<p>${escapeHtmlText(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * True when the document has no prose.
 *
 * TipTap serializes an empty document as `<p></p>`, so a string-length check on
 * the stored HTML reports "filled in" for a field the user never touched — which
 * would make every empty-state hint and every "is this section worth rendering"
 * decision wrong.
 */
export function isRichTextEmpty(html: string): boolean {
  return richTextToPlainText(html).length === 0;
}

/** Characters the user would count, used by the field's remaining-characters hint. */
export function richTextLength(html: string): number {
  return richTextToPlainText(html).length;
}
