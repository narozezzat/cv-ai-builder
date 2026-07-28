/**
 * The block above the first section: name, headline, how to reach the person.
 *
 * Shared by every layout, which is why it takes an `align` prop instead of each layout
 * shipping its own copy — a centred header and a left-aligned one differ by one CSS
 * value, not by a component.
 *
 * Contact details are the one place a resume becomes clickable, so each kind gets its own
 * guard: `mailto:` only for something shaped like an address, `tel:` only for something
 * shaped like a number, `http(s)` only via `ExternalLink`. Anything else renders as plain
 * text, still readable on paper and inert in a browser.
 */

import type { CSSProperties } from "react";

import type { ResumeBasics } from "@/types/resume";
import { isSafeHttpUrl } from "@/types/resume";

import type { ResolvedTemplate } from "../lib/resolve-template";
import { ExternalLink, headingFont, stripScheme } from "./resume-atoms";

/** Deliberately stricter than the schema: this string is going into an `href`. */
const EMAIL_SHAPE = /^[^\s@,;:<>"']+@[^\s@,;:<>"']+\.[^\s@,;:<>"']+$/;
const PHONE_SHAPE = /^[+()\-.\s\d]{4,}$/;

const PHOTO_RADIUS: Record<ResumeBasics["photo"]["shape"], string | number> = {
  circle: "50%",
  rounded: 8,
  square: 0,
};

export interface ResumeHeaderProps {
  template: ResolvedTemplate;
  basics: ResumeBasics;
  align?: "left" | "center";
}

export function ResumeHeader({ template, basics, align = "left" }: ResumeHeaderProps) {
  const { colors, type, spacing } = template;
  const centered = align === "center";
  const showPhoto = basics.photo.visible && isSafeHttpUrl(basics.photo.url);

  const contacts = [
    basics.email ? <EmailLink key="email" email={basics.email} /> : null,
    basics.phone ? <PhoneLink key="phone" phone={basics.phone} /> : null,
    basics.location ? <span key="location">{basics.location}</span> : null,
    basics.website ? (
      <ExternalLink key="website" template={template} href={basics.website} />
    ) : null,
    ...basics.socials
      .filter((social) => social.url || social.username)
      .map((social) => (
        <SocialItem
          key={social.id}
          template={template}
          network={social.network}
          username={social.username}
          url={social.url}
        />
      )),
  ].filter((entry) => entry !== null);

  const identity = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing.blockGapPx,
        alignItems: centered ? "center" : "flex-start",
        // Without this the flex item refuses to shrink and a long headline pushes the
        // photo off the page instead of wrapping.
        minWidth: 0,
      }}
    >
      {basics.fullName ? (
        <h1
          style={{
            ...headingFont(template),
            color: colors.heading,
            fontSize: type.namePx,
            fontWeight: 600,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
          }}
        >
          {basics.fullName}
        </h1>
      ) : null}

      {basics.headline ? (
        <p style={{ color: colors.accent, fontSize: type.headlinePx }}>{basics.headline}</p>
      ) : null}

      {contacts.length > 0 ? (
        <ul
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: centered ? "center" : "flex-start",
            gap: `${spacing.blockGapPx / 2}px ${spacing.blockGapPx * 2}px`,
            listStyle: "none",
            margin: 0,
            padding: 0,
            color: colors.muted,
            fontSize: type.bodyPx * 0.95,
          }}
        >
          {contacts.map((entry, index) => (
            <li key={index} style={{ display: "flex", gap: spacing.blockGapPx * 2 }}>
              {index > 0 ? (
                <span aria-hidden style={{ color: colors.rule }}>
                  |
                </span>
              ) : null}
              {entry}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  if (!showPhoto) {
    return <header style={headerStyle(centered)}>{identity}</header>;
  }

  const size = basics.photo.size * template.definition.tokens.density;

  return (
    <header
      style={{
        ...headerStyle(centered),
        flexDirection: centered ? "column" : "row",
        alignItems: "center",
        justifyContent: centered ? "center" : "space-between",
        gap: spacing.itemGapPx * 1.5,
      }}
    >
      {identity}
      {/*
        A plain `<img>`, not `next/image`: this tree is navigated to by headless Chromium
        for the PDF and rendered on a public share page, and the optimizer's URL would
        add a hop that has to succeed in both. The photo is a Supabase Storage object
        whose dimensions we already know.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={basics.photo.url}
        alt={basics.fullName ? `Photo of ${basics.fullName}` : "Profile photo"}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          flex: "none",
          objectFit: "cover",
          borderRadius: PHOTO_RADIUS[basics.photo.shape],
          border: `1px solid ${colors.rule}`,
        }}
      />
    </header>
  );
}

function headerStyle(centered: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    alignItems: centered ? "center" : "stretch",
    textAlign: centered ? "center" : "left",
    breakInside: "avoid",
  };
}

function EmailLink({ email }: { email: string }) {
  if (!EMAIL_SHAPE.test(email)) {
    return <span>{email}</span>;
  }

  return (
    <a href={`mailto:${email}`} style={{ color: "inherit", textDecoration: "none" }}>
      {email}
    </a>
  );
}

function PhoneLink({ phone }: { phone: string }) {
  if (!PHONE_SHAPE.test(phone)) {
    return <span>{phone}</span>;
  }

  return (
    <a
      href={`tel:${phone.replace(/[^+\d]/g, "")}`}
      style={{ color: "inherit", textDecoration: "none" }}
    >
      {phone}
    </a>
  );
}

/**
 * `LinkedIn · in/jane` reads worse on paper than `linkedin.com/in/jane`, so the URL wins
 * when there is one and the network name is only used when there is nothing to link.
 */
function SocialItem({
  template,
  network,
  username,
  url,
}: {
  template: ResolvedTemplate;
  network: string;
  username: string;
  url: string;
}) {
  if (!url) {
    return <span>{[network, username].filter(Boolean).join(" ")}</span>;
  }

  return (
    <ExternalLink template={template} href={url}>
      {username || network || stripScheme(url)}
    </ExternalLink>
  );
}
