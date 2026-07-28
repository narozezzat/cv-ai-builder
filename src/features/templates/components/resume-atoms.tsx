/**
 * The pieces every template is built out of.
 *
 * No `"use client"` anywhere in this folder, and no hooks — not even `useMemo`. These
 * components render in three places: a client-side live preview, a server-rendered print
 * route that headless Chromium navigates to, and a public share page. The only way one
 * tree can serve all three is if it is pure props in, JSX out.
 *
 * Styling is inline, not Tailwind, for the same reason. A resume is paper: its colours
 * come from the template's palette, not from the app's theme tokens, and `text-slate-900`
 * would follow the dashboard into dark mode and print white-on-white. Inline styles also
 * survive the trip into Puppeteer without depending on a stylesheet having loaded.
 *
 * `ResolvedTemplate` is threaded as a prop rather than shared through context because
 * `createContext` is a client-only API and this tree has to render on the server.
 */

import type { CSSProperties, ReactNode } from "react";

import { isSafeHttpUrl, SKILL_LEVEL_MAX } from "@/types/resume";
import { renderRichText } from "@/utils/render-rich-text";
import { isRichTextEmpty } from "@/utils/rich-text";

import { resumeFontFamily } from "../lib/fonts";
import type { ResolvedTemplate } from "../lib/resolve-template";

/** Applied to every user-supplied link in the tree. Matches `renderRichText`'s. */
const LINK_REL = "noopener noreferrer nofollow ugc";

export interface TemplatePartProps {
  template: ResolvedTemplate;
}

export function headingFont(template: ResolvedTemplate): CSSProperties {
  return { fontFamily: resumeFontFamily(template.fonts.heading) };
}

/** Keeps one item — title, dates, prose, bullets — from being split across two pages. */
const AVOID_BREAK: CSSProperties = { breakInside: "avoid" };

export function SectionShell({
  template,
  title,
  children,
}: TemplatePartProps & { title: string; children: ReactNode }) {
  const { colors, type, definition, spacing } = template;
  const { sectionTitle } = definition.tokens;

  const titleStyle: CSSProperties = {
    ...headingFont(template),
    fontSize: type.sectionTitlePx,
    fontWeight: 600,
    letterSpacing: `${type.sectionTitleTracking}em`,
    textTransform: type.uppercaseSectionTitles ? "uppercase" : "none",
    color: sectionTitle === "bar" ? colors.onAccent : colors.heading,
    ...(sectionTitle === "underline"
      ? { borderBottom: `1px solid ${colors.rule}`, paddingBottom: spacing.blockGapPx }
      : {}),
    ...(sectionTitle === "bar"
      ? {
          backgroundColor: colors.accent,
          padding: `${spacing.blockGapPx}px ${spacing.blockGapPx * 2}px`,
        }
      : {}),
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: spacing.itemGapPx }}>
      <h2 style={titleStyle}>{title}</h2>
      {children}
    </section>
  );
}

/** The vertical stack of items inside a section, with optional hairlines between them. */
export function ItemList({ template, children }: TemplatePartProps & { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: template.spacing.itemGapPx }}>
      {children}
    </div>
  );
}

export function ItemShell({
  template,
  divider,
  children,
}: TemplatePartProps & { divider: boolean; children: ReactNode }) {
  return (
    <div
      style={{
        ...AVOID_BREAK,
        display: "flex",
        flexDirection: "column",
        gap: template.spacing.blockGapPx,
        ...(divider
          ? {
              borderTop: `1px solid ${template.colors.rule}`,
              paddingTop: template.spacing.itemGapPx,
            }
          : {}),
      }}
    >
      {children}
    </div>
  );
}

/**
 * Title on the left, dates on the right, both on one line — the arrangement a recruiter
 * scans. `flex-wrap` rather than truncation: a long job title must not lose characters,
 * it wraps and the date drops beneath it.
 */
export function ItemHeader({
  template,
  title,
  meta,
  aside,
}: TemplatePartProps & { title: ReactNode; meta?: ReactNode; aside?: string }) {
  const { colors, spacing } = template;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        justifyContent: "space-between",
        columnGap: spacing.itemGapPx,
        rowGap: spacing.blockGapPx / 2,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.blockGapPx / 2 }}>
        <p style={{ ...headingFont(template), color: colors.heading, fontWeight: 600 }}>{title}</p>
        {meta ? <p style={{ color: colors.muted }}>{meta}</p> : null}
      </div>
      {aside ? (
        <p
          style={{ color: colors.muted, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
        >
          {aside}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Joins metadata with a middle dot, dropping the empties. Every caller passes optional
 * fields, so filtering here is the difference between "Berlin · Remote" and
 * "Berlin ·  · ".
 */
export function joinMeta(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(" · ");
}

/**
 * Stored HTML, hardened on the way to the DOM.
 *
 * `dangerouslySetInnerHTML` is the point of the component: rich text is stored as HTML,
 * and the alternative — parsing it into React elements — would need a second parser that
 * could disagree with the sanitizer. `renderRichText` is the guarantee, and it is applied
 * here rather than by callers so no future section block can forget it.
 */
export function RichText({ template, html }: TemplatePartProps & { html: string }) {
  if (isRichTextEmpty(html)) {
    return null;
  }

  // Styled by the `<style>` block the renderer emits, keyed off this attribute. Injected
  // HTML cannot carry inline styles, and a stylesheet is the one thing a print route or
  // a share page might not have loaded — so the renderer ships its own.
  return (
    <div
      data-resume-prose=""
      style={{ color: template.colors.body }}
      dangerouslySetInnerHTML={{ __html: renderRichText(html) }}
    />
  );
}

export function Bullets({ template, items }: TemplatePartProps & { items: ReadonlyArray<string> }) {
  const visible = items.filter((item) => item.trim().length > 0);

  if (visible.length === 0) {
    return null;
  }

  const dash = template.definition.tokens.bullet === "dash";

  return (
    <ul
      style={{
        display: "flex",
        flexDirection: "column",
        gap: template.spacing.blockGapPx / 2,
        // The marker is drawn by a pseudo-element in `resume-prose`-adjacent CSS for
        // rich text, but structured highlights are plain strings, so the glyph is put in
        // the DOM here. `listStyle: none` keeps the two from doubling up.
        listStyle: "none",
        color: template.colors.body,
        paddingLeft: 0,
        margin: 0,
      }}
    >
      {visible.map((item, index) => (
        <li key={index} style={{ display: "flex", gap: template.spacing.blockGapPx * 1.5 }}>
          <span aria-hidden style={{ color: template.colors.accent }}>
            {dash ? "–" : "•"}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Skill keywords, technologies, interests — short strings that read better as pills. */
export function Tags({ template, values }: TemplatePartProps & { values: ReadonlyArray<string> }) {
  const visible = values.filter((value) => value.trim().length > 0);

  if (visible.length === 0) {
    return null;
  }

  return (
    <ul
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: template.spacing.blockGapPx,
        listStyle: "none",
        padding: 0,
        margin: 0,
        color: template.colors.muted,
        fontSize: template.type.bodyPx * 0.9,
      }}
    >
      {visible.map((value) => (
        <li
          key={value}
          style={{
            border: `1px solid ${template.colors.rule}`,
            borderRadius: 999,
            padding: `0 ${template.spacing.blockGapPx * 1.5}px`,
          }}
        >
          {value}
        </li>
      ))}
    </ul>
  );
}

/**
 * The skill meter. `level: 0` means "not rated" in the schema, and an unrated skill
 * renders as its name alone — five empty dots would claim the user scored themselves
 * zero.
 */
export function LevelMeter({
  template,
  level,
  label,
}: TemplatePartProps & { level: number; label: string }) {
  if (level <= 0) {
    return null;
  }

  const size = Math.max(4, template.type.bodyPx * 0.4);

  return (
    <span
      role="img"
      aria-label={label}
      style={{ display: "inline-flex", gap: size / 2, alignItems: "center" }}
    >
      {Array.from({ length: SKILL_LEVEL_MAX }, (_, index) => (
        <span
          key={index}
          style={{
            width: size,
            height: size,
            borderRadius: 999,
            backgroundColor: index < level ? template.colors.accent : template.colors.rule,
          }}
        />
      ))}
    </span>
  );
}

/**
 * A link, or the plain text of one when the URL is not http(s).
 *
 * The schema validates these fields, but a document can reach a renderer without passing
 * through it — a restored version row, an imported JSON file, a service-role write — and
 * an `href` is the one place a bad string becomes executable.
 */
export function ExternalLink({
  template,
  href,
  children,
}: TemplatePartProps & { href: string; children?: ReactNode }) {
  const label = children ?? stripScheme(href);

  if (!isSafeHttpUrl(href)) {
    return <>{label}</>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel={LINK_REL}
      style={{ color: template.colors.accent, textDecoration: "none" }}
    >
      {label}
    </a>
  );
}

/** `https://github.com/x` reads as `github.com/x` on paper. */
export function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
