/**
 * The stylesheet the renderer ships with every page it draws.
 *
 * Two things cannot be expressed as an inline `style` prop, and both live here:
 *
 * 1. **Rich text.** It arrives as an HTML string, so it cannot carry inline styles the way
 *    the rest of the tree does. It needs real selectors — and the print route and the
 *    public share page are exactly the contexts where the app's stylesheet may not be in
 *    the tree, so the renderer carries its own rather than depending on one.
 * 2. **Paged media.** `@page`, `orphans`, `widows`, and `break-*` have no inline
 *    equivalent for the page box, and they are the difference between a PDF that looks
 *    like the preview and one that clips a job title off the bottom of a sheet.
 *
 * Kept out of the component so the print rules can be asserted directly — the alternative
 * is rendering to a string and grepping it, which tests React more than it tests the CSS.
 *
 * Only template-derived numbers and the already hex-validated palette are interpolated
 * here. No user text reaches these strings.
 */

import type { ResolvedTemplate } from "./resolve-template";

/**
 * A per-page scope for the emitted rules.
 *
 * Without it, two resumes on one screen — the template gallery renders twenty — would
 * fight over the same `[data-resume-prose]` rules and every thumbnail would take the last
 * one's accent and spacing. Derived, not random, because a hook-free tree has no `useId`
 * and the server and client renders have to agree.
 */
export function proseScope(template: ResolvedTemplate): string {
  const parts = [
    template.definition.id,
    template.colors.id,
    template.colors.accent,
    // Two resumes on the same template can still differ in type size and rhythm.
    Math.round(template.type.bodyPx * 100),
    Math.round(template.spacing.blockGapPx * 100),
  ];

  // This value goes into a CSS selector, so it is reduced to a character class that
  // cannot terminate one. Every input is registry- or schema-controlled today; the
  // filter is what keeps that from being load-bearing.
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

/** Rounded, and never `NaN` — an invalid length would invalidate the whole declaration. */
function px(value: number): string {
  return `${Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}px`;
}

export interface ResumeStyleOptions {
  /** True on the print route. Gates the `@page` rule — see `pageRules`. */
  printTarget: boolean;
}

/** Everything the renderer puts in its `<style>` block, in one string. */
export function resumeStyles(
  template: ResolvedTemplate,
  scope: string,
  { printTarget }: ResumeStyleOptions,
): string {
  return [
    ...proseRules(template, scope),
    ...paginationRules(scope),
    ...(printTarget ? pageRules(template) : []),
  ].join("");
}

function proseRules(template: ResolvedTemplate, scope: string): string[] {
  const { colors, spacing, definition } = template;
  const root = `[data-resume-scope="${scope}"] [data-resume-prose]`;
  const bullet = definition.tokens.bullet === "dash" ? "–" : "•";

  // Matches `Bullets` in `resume-atoms.tsx` deliberately: a highlight typed into the
  // rich-text editor and one typed into the bullet list must look identical, because the
  // reader has no idea which field produced which line.
  return [
    `${root}{display:flex;flex-direction:column;gap:${px(spacing.blockGapPx)}}`,
    `${root} p{margin:0}`,
    `${root} strong{font-weight:600}`,
    `${root} em{font-style:italic}`,
    `${root} a{color:${colors.accent};text-decoration:none}`,
    `${root} ul{display:flex;flex-direction:column;gap:${px(spacing.blockGapPx / 2)};list-style:none;margin:0;padding:0}`,
    `${root} li{display:flex;gap:${px(spacing.blockGapPx * 1.5)}}`,
    `${root} li::before{content:"${bullet}";color:${colors.accent};flex:none}`,
    // TipTap's `ListItem` takes block content, so a bullet round-trips as
    // `<li><p>…</p></li>`. Without this the paragraph reset above is not enough to stop
    // the browser's default list spacing from reappearing inside the flex row.
    `${root} li>p{margin:0;flex:1}`,
  ];
}

/**
 * Where Chromium is allowed to cut the page.
 *
 * Emitted for preview as well as print, not only because the user may hit `Cmd+P` on the
 * editor, but because these properties are inert outside paged media — there is no page
 * box to break in a scrolling preview, so there is nothing to keep in sync.
 *
 * The legacy `page-break-*` aliases go out alongside the modern `break-*` ones: Chromium
 * maps them to the same internal property, and a Chromium old enough to be running in
 * someone's print pipeline may only understand the alias.
 */
function paginationRules(scope: string): string[] {
  const page = `[data-resume-scope="${scope}"]`;

  return [
    // Both inherit, so setting them on the page applies to every block inside it. Two
    // lines is the floor at which a paragraph split across a sheet still reads as prose.
    `${page}{orphans:2;widows:2}`,
    // A heading stranded as the last line on a sheet labels the wrong content: the reader
    // turns the page and finds the section it introduced.
    `${page} h1,${page} h2,${page} h3{page-break-after:avoid;break-after:avoid;page-break-inside:avoid;break-inside:avoid}`,
    // Items already carry `break-inside: avoid` inline (`ItemShell`); bullets do not, and a
    // two-line highlight cut in half is the most common way a resume PDF looks broken.
    `${page} li{page-break-inside:avoid;break-inside:avoid}`,
  ];
}

/**
 * The paper itself. Print target only.
 *
 * `@page` is document-global and cannot be scoped to an element, so emitting it from every
 * rendered resume would have the gallery's twenty thumbnails each declare a different sheet
 * size and let the last one win. The print route renders exactly one resume, which is the
 * only context where a document-global rule is safe to write.
 *
 * `margin: 0` — the page margin is already applied as padding on the `<article>`, so any
 * margin here would double it. That also means the full-bleed regions (banner fills, solid
 * sidebars) escape their padding all the way to the paper edge exactly as they do on
 * screen, which is the whole reason preview and PDF can be compared pixel for pixel.
 *
 * The cost is deliberate and worth naming: because the padding belongs to the box and not
 * to the sheet, a resume that runs past one page starts page two flush against the paper
 * edge. Repeating a gutter per sheet needs `@page` margins, which would inset every
 * full-bleed region and break page one for the nine templates built around one. Keeping
 * page one exact and leaning on `break-inside`/`widows` for the tail is the better trade
 * until the renderer paginates into real page boxes itself.
 */
function pageRules(template: ResolvedTemplate): string[] {
  const { page, colors } = template;

  return [
    `@page{size:${px(page.widthPx)} ${px(page.heightPx)};margin:0}`,
    // The print route has no app stylesheet and therefore no reset. A `body` margin would
    // shift the sheet and cost a blank trailing page.
    `@media print{html,body{margin:0;padding:0;background:${colors.surface}}}`,
    // Inherited, so the article's inline `print-color-adjust` already covers its subtree —
    // except for the page background above, which is not in that subtree.
    `@media print{html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`,
  ];
}
