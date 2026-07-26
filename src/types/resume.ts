/**
 * The canonical resume document.
 *
 * `resumes.content jsonb` holds exactly what this file describes, and the
 * relational tables in the projections migration are rebuilt from it by
 * `reshred_resume_content()`. Everything downstream — the editor store, the live
 * preview, the template layouts, the PDF renderer, the AI prompts, JSON
 * import/export — derives its types from here rather than declaring its own.
 *
 * Three rules govern the shape:
 *
 * 1. **Key names are a contract with the trigger.** The trigger reads
 *    `item ->> 'employmentType'`, `item ->> 'repoUrl'`, `item ->> 'issueDate'`
 *    and so on. Renaming a field here without renaming it there does not fail —
 *    it silently projects `null`. `resume-reshred.test.ts` compares the two key
 *    sets so that mistake is a failing test instead of an empty search index.
 *
 * 2. **Empty string, not `undefined`.** Optional text is `""` throughout, which
 *    is what a controlled input holds and what the trigger turns into a null
 *    column. Nothing in the document is optional-by-absence except the two
 *    top-level keys, which have to tolerate `resumes.content`'s `'{}'` default.
 *
 * 3. **Everything is bounded.** A document is rendered by headless Chromium on a
 *    server we pay for; unbounded arrays and unbounded strings are a denial of
 *    service with extra steps. The limits below are generous for a real resume
 *    and hostile to a generated one.
 *
 * Unknown keys are stripped rather than rejected (Zod's default). A document
 * written by a newer build therefore opens in an older one, losing the fields it
 * did not know about on the next save — a lossy read beats a resume that refuses
 * to open.
 *
 * Rich-text fields hold TipTap's HTML. Bounded here, sanitized on the way in and
 * out by the editor's sanitizer — length validation is not sanitization.
 */

import { z } from "zod";

// ── Limits ────────────────────────────────────────────────────────────────────

/**
 * Every bound in one object so the editor can show "23 / 30 bullets" without
 * hardcoding the number a second time.
 */
export const RESUME_LIMITS = {
  /** Text that sits on one line in every template: company, job title, city. */
  shortText: 200,
  /** Person and institution names. */
  nameText: 120,
  phoneText: 40,
  /** One bullet point. */
  highlightText: 500,
  /** A per-item description or summary. Rich text, so HTML counts. */
  itemRichText: 2000,
  /** The standalone summary section. */
  sectionRichText: 8000,
  keywordText: 80,
  urlText: 2048,
  sections: 40,
  itemsPerSection: 100,
  highlightsPerItem: 30,
  technologiesPerItem: 40,
  keywordsPerItem: 30,
  socials: 12,
} as const;

/**
 * Bumped only when the document shape changes in a way a reader must know about.
 * Stored in the document so a future migration can find the old ones; nothing
 * branches on it yet, and a document that omits it reads as version 1.
 */
export const RESUME_DOCUMENT_VERSION = 1;

// ── Field primitives ──────────────────────────────────────────────────────────

/** Stable per-item identity, generated client-side so undo/redo can key on it. */
const idText = z.string().trim().min(1).max(64);

const boundedText = (max: number) => z.string().trim().max(max);

/** Not trimmed: leading whitespace inside HTML is markup, not user sloppiness. */
const richText = (max: number) => z.string().max(max);

/**
 * An absolute `http(s)` URL.
 *
 * Zod's `.url()` is not enough on its own: it accepts any parseable URL, and
 * `javascript:alert(1)` parses. Every one of these values ends up in an `href` of
 * a document the user publishes at `/r/[slug]`, so the scheme is the control that
 * matters and `.url()` alone would have shipped a stored-XSS vector.
 *
 * Exported because the TipTap link sanitizer and the renderer must apply exactly
 * this test — one definition, not three that drift.
 */
export function isSafeHttpUrl(value: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    // Relative and scheme-less input included: an anchor in a PDF has no base to
    // resolve against, so "example.com" is not a usable link either.
    return false;
  }

  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

/** A safe URL or nothing. `""` rather than `null` for the reason in the header. */
const urlText = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .max(RESUME_LIMITS.urlText)
    .refine(isSafeHttpUrl, "Enter a full link starting with http:// or https://"),
]);

const emailText = z.union([z.literal(""), z.string().trim().email().max(RESUME_LIMITS.shortText)]);

/**
 * Resume dates are partial by nature: users write "2021" or "2021-03" and mean
 * it. The document stores what they typed; `resume_parse_date()` in Postgres
 * anchors it to the first of the period for querying.
 *
 * The pattern is narrower than that function tolerates on purpose — the function
 * returns null on anything unparseable so a bad date can never block a save, and
 * this makes sure the app never produces one.
 */
export const RESUME_DATE_PATTERN = /^$|^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;

const dateText = z
  .string()
  .trim()
  .regex(RESUME_DATE_PATTERN, "Use a year, YYYY-MM, or YYYY-MM-DD.");

const highlightList = z
  .array(boundedText(RESUME_LIMITS.highlightText))
  .max(RESUME_LIMITS.highlightsPerItem);

const keywordList = z
  .array(boundedText(RESUME_LIMITS.keywordText))
  .max(RESUME_LIMITS.keywordsPerItem);

const technologyList = z
  .array(boundedText(RESUME_LIMITS.keywordText))
  .max(RESUME_LIMITS.technologiesPerItem);

/**
 * A closed enum plus the empty string, which is how "not specified" is spelled
 * in a `<select>` that has no null.
 */
const optionalEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.literal(""), z.enum(values)]);

// ── Vocabularies ──────────────────────────────────────────────────────────────

/**
 * Volunteering is an employment type rather than its own section kind: the fields
 * are identical to a job's, and a separate kind would mean a projection table
 * that duplicates `experience` or volunteer work invisible to every query.
 */
export const EMPLOYMENT_TYPES = [
  "full-time",
  "part-time",
  "contract",
  "freelance",
  "internship",
  "apprenticeship",
  "temporary",
  "volunteer",
  "self-employed",
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  freelance: "Freelance",
  internship: "Internship",
  apprenticeship: "Apprenticeship",
  temporary: "Temporary",
  volunteer: "Volunteer",
  "self-employed": "Self-employed",
};

/**
 * Plain-language levels rather than CEFR codes. "B2" is precise and means nothing
 * to most recruiters; these are the words that actually appear on resumes.
 */
export const LANGUAGE_PROFICIENCIES = [
  "native",
  "fluent",
  "professional",
  "intermediate",
  "elementary",
] as const;

export type LanguageProficiency = (typeof LANGUAGE_PROFICIENCIES)[number];

export const LANGUAGE_PROFICIENCY_LABELS: Record<LanguageProficiency, string> = {
  native: "Native / bilingual",
  fluent: "Fluent",
  professional: "Professional working",
  intermediate: "Intermediate",
  elementary: "Elementary",
};

/** Highest skill level. 0 means "listed, not rated" — templates hide the meter. */
export const SKILL_LEVEL_MAX = 5;

export const SKILL_LEVEL_LABELS: Record<number, string> = {
  0: "Not rated",
  1: "Beginner",
  2: "Elementary",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

/**
 * Suggestions for the network field, not a constraint on it — people put links to
 * things no allowlist would predict, and rejecting them would be the wrong
 * tradeoff for a field whose only job is to render an icon and a label.
 */
export const SOCIAL_NETWORKS = [
  "LinkedIn",
  "GitHub",
  "GitLab",
  "X",
  "Portfolio",
  "Behance",
  "Dribbble",
  "Stack Overflow",
  "Medium",
  "YouTube",
  "Google Scholar",
  "ORCID",
] as const;

// ── Basics ────────────────────────────────────────────────────────────────────

/** Projected into `social_links`; keys are read by the trigger. */
export const socialLinkSchema = z.object({
  id: idText,
  network: boundedText(RESUME_LIMITS.nameText),
  username: boundedText(RESUME_LIMITS.nameText),
  url: urlText,
});

export type SocialLink = z.infer<typeof socialLinkSchema>;

export const PHOTO_SHAPES = ["circle", "rounded", "square"] as const;
export type PhotoShape = (typeof PHOTO_SHAPES)[number];

/**
 * A photo is off by default. It is illegal to consider in some jurisdictions,
 * routinely stripped by ATS parsers, and a liability in the ones where it is
 * allowed — so it is a decision the user makes, not a field they have to find and
 * empty.
 */
export const resumePhotoSchema = z.object({
  url: urlText.default(""),
  visible: z.boolean().default(false),
  shape: z.enum(PHOTO_SHAPES).default("circle"),
  /** Rendered edge length in px at scale 1. */
  size: z.number().int().min(48).max(160).default(96),
});

export type ResumePhoto = z.infer<typeof resumePhotoSchema>;

/**
 * The header block. Not projected beyond `socials` — none of it is worth a table,
 * and the contact details of every user in one queryable place is a liability
 * rather than a feature.
 *
 * There is deliberately no `summary` here: the professional summary is a section,
 * so it can be retitled, reordered, and hidden like everything else.
 */
export const resumeBasicsSchema = z.object({
  fullName: boundedText(RESUME_LIMITS.nameText).default(""),
  headline: boundedText(RESUME_LIMITS.shortText).default(""),
  email: emailText.default(""),
  phone: boundedText(RESUME_LIMITS.phoneText).default(""),
  location: boundedText(RESUME_LIMITS.shortText).default(""),
  website: urlText.default(""),
  photo: resumePhotoSchema.default(() => resumePhotoSchema.parse({})),
  socials: z.array(socialLinkSchema).max(RESUME_LIMITS.socials).default([]),
});

export type ResumeBasics = z.infer<typeof resumeBasicsSchema>;

// ── Section items ─────────────────────────────────────────────────────────────
//
// One schema per projection table. Field names match the trigger's jsonb keys
// exactly; the JSON Resume names are kept where they exist (`position` for a job
// title, `area` for a field of study) so import/export needs no rename layer.

export const experienceItemSchema = z.object({
  id: idText,
  company: boundedText(RESUME_LIMITS.nameText),
  position: boundedText(RESUME_LIMITS.shortText),
  employmentType: optionalEnum(EMPLOYMENT_TYPES),
  location: boundedText(RESUME_LIMITS.shortText),
  url: urlText,
  startDate: dateText,
  endDate: dateText,
  /** When true, templates render "Present" and `endDate` is ignored. */
  current: z.boolean(),
  summary: richText(RESUME_LIMITS.itemRichText),
  highlights: highlightList,
  technologies: technologyList,
});

export const educationItemSchema = z.object({
  id: idText,
  institution: boundedText(RESUME_LIMITS.nameText),
  degree: boundedText(RESUME_LIMITS.shortText),
  area: boundedText(RESUME_LIMITS.shortText),
  location: boundedText(RESUME_LIMITS.shortText),
  url: urlText,
  startDate: dateText,
  endDate: dateText,
  current: z.boolean(),
  grade: boundedText(RESUME_LIMITS.nameText),
  summary: richText(RESUME_LIMITS.itemRichText),
  highlights: highlightList,
});

export const projectItemSchema = z.object({
  id: idText,
  name: boundedText(RESUME_LIMITS.nameText),
  role: boundedText(RESUME_LIMITS.shortText),
  description: richText(RESUME_LIMITS.itemRichText),
  url: urlText,
  repoUrl: urlText,
  startDate: dateText,
  endDate: dateText,
  highlights: highlightList,
  technologies: technologyList,
});

export const skillItemSchema = z.object({
  id: idText,
  name: boundedText(RESUME_LIMITS.nameText),
  /** Free text: "Languages", "Cloud", "Design". Groups the list in most layouts. */
  category: boundedText(RESUME_LIMITS.nameText),
  level: z.number().int().min(0).max(SKILL_LEVEL_MAX),
  keywords: keywordList,
});

export const languageItemSchema = z.object({
  id: idText,
  name: boundedText(RESUME_LIMITS.nameText),
  proficiency: optionalEnum(LANGUAGE_PROFICIENCIES),
});

/** Section kind is `certifications`; the projection table is `certificates`. */
export const certificationItemSchema = z.object({
  id: idText,
  name: boundedText(RESUME_LIMITS.shortText),
  issuer: boundedText(RESUME_LIMITS.nameText),
  issueDate: dateText,
  expiryDate: dateText,
  credentialId: boundedText(RESUME_LIMITS.nameText),
  url: urlText,
});

export const awardItemSchema = z.object({
  id: idText,
  title: boundedText(RESUME_LIMITS.shortText),
  issuer: boundedText(RESUME_LIMITS.nameText),
  /** Projected as `awards.awarded_on`. */
  date: dateText,
  summary: richText(RESUME_LIMITS.itemRichText),
});

export const publicationItemSchema = z.object({
  id: idText,
  name: boundedText(RESUME_LIMITS.shortText),
  publisher: boundedText(RESUME_LIMITS.nameText),
  /** Projected as `publications.released_on`. */
  releaseDate: dateText,
  url: urlText,
  summary: richText(RESUME_LIMITS.itemRichText),
});

/** Projection table is `resume_references`; `references` is a reserved word. */
export const referenceItemSchema = z.object({
  id: idText,
  name: boundedText(RESUME_LIMITS.nameText),
  relationship: boundedText(RESUME_LIMITS.shortText),
  company: boundedText(RESUME_LIMITS.nameText),
  email: emailText,
  phone: boundedText(RESUME_LIMITS.phoneText),
  summary: richText(RESUME_LIMITS.itemRichText),
});

export const interestItemSchema = z.object({
  id: idText,
  name: boundedText(RESUME_LIMITS.nameText),
  keywords: keywordList,
});

/**
 * The escape hatch, and the reason "unlimited sections" is true rather than
 * marketing: one generic item shape that covers speaking engagements, patents,
 * military service, coursework, and whatever else a user needs.
 */
export const customItemSchema = z.object({
  id: idText,
  name: boundedText(RESUME_LIMITS.shortText),
  subtitle: boundedText(RESUME_LIMITS.shortText),
  /** Projected as `resume_custom_entries.dated_on`. */
  date: dateText,
  url: urlText,
  description: richText(RESUME_LIMITS.itemRichText),
  highlights: highlightList,
});

export type ExperienceItem = z.infer<typeof experienceItemSchema>;
export type EducationItem = z.infer<typeof educationItemSchema>;
export type ProjectItem = z.infer<typeof projectItemSchema>;
export type SkillItem = z.infer<typeof skillItemSchema>;
export type LanguageItem = z.infer<typeof languageItemSchema>;
export type CertificationItem = z.infer<typeof certificationItemSchema>;
export type AwardItem = z.infer<typeof awardItemSchema>;
export type PublicationItem = z.infer<typeof publicationItemSchema>;
export type ReferenceItem = z.infer<typeof referenceItemSchema>;
export type InterestItem = z.infer<typeof interestItemSchema>;
export type CustomItem = z.infer<typeof customItemSchema>;

// ── Sections ──────────────────────────────────────────────────────────────────

export const RESUME_SECTION_KINDS = [
  "summary",
  "experience",
  "education",
  "projects",
  "skills",
  "languages",
  "certifications",
  "awards",
  "publications",
  "references",
  "interests",
  "custom",
] as const;

export type ResumeSectionKind = (typeof RESUME_SECTION_KINDS)[number];

/**
 * Shared across every kind, and read by the trigger for `resume_sections`.
 * `visible` defaults to true to match `jsonb_to_bool(section -> 'visible', true)`
 * — a section nobody has touched should render.
 */
const sectionBase = {
  id: idText,
  title: z.string().trim().min(1).max(RESUME_LIMITS.nameText),
  visible: z.boolean().default(true),
};

const itemsOf = <TSchema extends z.ZodTypeAny>(schema: TSchema) =>
  z.array(schema).max(RESUME_LIMITS.itemsPerSection);

/**
 * The one section with prose instead of items.
 *
 * It still gets a `resume_sections` row — kind, title, visibility, and position
 * are what that table is for — but no item rows, the same way `basics` is stored
 * and rendered without being projected.
 */
export const summarySectionSchema = z.object({
  ...sectionBase,
  kind: z.literal("summary"),
  content: richText(RESUME_LIMITS.sectionRichText),
});

export const experienceSectionSchema = z.object({
  ...sectionBase,
  kind: z.literal("experience"),
  items: itemsOf(experienceItemSchema),
});

export const educationSectionSchema = z.object({
  ...sectionBase,
  kind: z.literal("education"),
  items: itemsOf(educationItemSchema),
});

export const projectsSectionSchema = z.object({
  ...sectionBase,
  kind: z.literal("projects"),
  items: itemsOf(projectItemSchema),
});

export const skillsSectionSchema = z.object({
  ...sectionBase,
  kind: z.literal("skills"),
  items: itemsOf(skillItemSchema),
});

export const languagesSectionSchema = z.object({
  ...sectionBase,
  kind: z.literal("languages"),
  items: itemsOf(languageItemSchema),
});

export const certificationsSectionSchema = z.object({
  ...sectionBase,
  kind: z.literal("certifications"),
  items: itemsOf(certificationItemSchema),
});

export const awardsSectionSchema = z.object({
  ...sectionBase,
  kind: z.literal("awards"),
  items: itemsOf(awardItemSchema),
});

export const publicationsSectionSchema = z.object({
  ...sectionBase,
  kind: z.literal("publications"),
  items: itemsOf(publicationItemSchema),
});

export const referencesSectionSchema = z.object({
  ...sectionBase,
  kind: z.literal("references"),
  items: itemsOf(referenceItemSchema),
});

export const interestsSectionSchema = z.object({
  ...sectionBase,
  kind: z.literal("interests"),
  items: itemsOf(interestItemSchema),
});

export const customSectionSchema = z.object({
  ...sectionBase,
  kind: z.literal("custom"),
  items: itemsOf(customItemSchema),
});

/**
 * Discriminated on `kind`, which is what makes the editor's section switch and
 * the layout's renderer switch exhaustive at compile time — a new kind is a type
 * error in every place that has to handle it.
 */
export const resumeSectionSchema = z.discriminatedUnion("kind", [
  summarySectionSchema,
  experienceSectionSchema,
  educationSectionSchema,
  projectsSectionSchema,
  skillsSectionSchema,
  languagesSectionSchema,
  certificationsSectionSchema,
  awardsSectionSchema,
  publicationsSectionSchema,
  referencesSectionSchema,
  interestsSectionSchema,
  customSectionSchema,
]);

export type ResumeSection = z.infer<typeof resumeSectionSchema>;

/** The section of a given kind, e.g. `ResumeSectionOf<"skills">`. */
export type ResumeSectionOf<TKind extends ResumeSectionKind> = Extract<
  ResumeSection,
  { kind: TKind }
>;

/** Every section except `summary`, i.e. the ones a `RepeatableSection` can drive. */
export type ItemSection = Exclude<ResumeSection, { kind: "summary" }>;

export type ItemSectionKind = ItemSection["kind"];

export type ResumeSectionItem = ItemSection["items"][number];

/** Narrows away the one prose section so generic item handling stays type-safe. */
export function isItemSection(section: ResumeSection): section is ItemSection {
  return section.kind !== "summary";
}

export const SECTION_KIND_LABELS: Record<ResumeSectionKind, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  projects: "Projects",
  skills: "Skills",
  languages: "Languages",
  certifications: "Certifications",
  awards: "Awards",
  publications: "Publications",
  references: "References",
  interests: "Interests",
  custom: "Custom section",
};

/**
 * Default heading for a new section. Separate from the label because the label
 * names the *kind* in the UI and the title is printed on the resume — "Custom
 * section" is a fine menu entry and a terrible heading.
 */
export const SECTION_DEFAULT_TITLES: Record<ResumeSectionKind, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  projects: "Projects",
  skills: "Skills",
  languages: "Languages",
  certifications: "Certifications",
  awards: "Awards",
  publications: "Publications",
  references: "References",
  interests: "Interests",
  custom: "Untitled section",
};

/** One-line explanation for the "add section" menu. */
export const SECTION_KIND_DESCRIPTIONS: Record<ResumeSectionKind, string> = {
  summary: "A short paragraph about what you do.",
  experience: "Jobs, contracts, and volunteering.",
  education: "Degrees, diplomas, and coursework.",
  projects: "Things you built, shipped, or contributed to.",
  skills: "Tools and abilities, optionally rated.",
  languages: "Languages you speak and how well.",
  certifications: "Credentials with an issuer and a date.",
  awards: "Recognition, prizes, and honours.",
  publications: "Papers, articles, and books.",
  references: "People who will vouch for you.",
  interests: "Outside work, kept brief.",
  custom: "Anything the other sections don't cover.",
};

// ── Document ──────────────────────────────────────────────────────────────────

/**
 * Both keys carry defaults so that `resumeDocumentSchema.parse({})` succeeds:
 * `resumes.content` defaults to `'{}'`, and `reshred_resume_content()` tolerates
 * a document with no `sections`. A brand-new row must therefore be readable
 * before anything has been written to it.
 */
export const resumeDocumentSchema = z.object({
  version: z.number().int().positive().default(RESUME_DOCUMENT_VERSION),
  basics: resumeBasicsSchema.default(() => resumeBasicsSchema.parse({})),
  sections: z.array(resumeSectionSchema).max(RESUME_LIMITS.sections).default([]),
});

export type ResumeDocument = z.infer<typeof resumeDocumentSchema>;

// ── Page setup ────────────────────────────────────────────────────────────────

export const PAGE_FORMATS = ["a4", "letter"] as const;
export type PageFormat = (typeof PAGE_FORMATS)[number];

export const PAGE_FORMAT_LABELS: Record<PageFormat, string> = {
  a4: "A4",
  letter: "US Letter",
};

/**
 * Millimetres, because that is what `@page` and Puppeteer's `page.pdf()` both
 * take. The preview converts to px once, at the top of the renderer.
 */
export const PAGE_DIMENSIONS_MM: Record<PageFormat, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
};

/**
 * Geometry only. Typography lives in the theme, so switching template cannot
 * silently change the margins a user set.
 *
 * Stored in `resumes.page jsonb`, which defaults to `'{}'` — hence a default on
 * every field.
 */
export const resumePageSchema = z.object({
  format: z.enum(PAGE_FORMATS).default("a4"),
  /** Uniform page margin in mm. Below ~8mm most consumer printers clip. */
  margin: z.number().min(8).max(30).default(14),
  /** Whole-document zoom, applied to the type scale as well as the spacing. */
  scale: z.number().min(0.7).max(1.3).default(1),
  showPageNumbers: z.boolean().default(false),
});

export type ResumePage = z.infer<typeof resumePageSchema>;

// ── Theme ─────────────────────────────────────────────────────────────────────

/**
 * The fonts the app commits to loading. A closed set rather than free text
 * because each id maps to a `next/font` loader in the template registry — an
 * unrecognized family would render as a fallback in the preview and, worse,
 * differently again in the PDF.
 *
 * `null` anywhere below means "whatever the template chose", which is how 20
 * templates keep their own typography without every resume storing a copy of it.
 */
export const RESUME_FONTS = [
  "inter",
  "geist",
  "ibm-plex-sans",
  "lato",
  "source-sans-3",
  "merriweather",
  "source-serif-4",
  "lora",
  "playfair-display",
  "jetbrains-mono",
] as const;

export type ResumeFont = (typeof RESUME_FONTS)[number];

export const RESUME_FONT_LABELS: Record<ResumeFont, string> = {
  inter: "Inter",
  geist: "Geist",
  "ibm-plex-sans": "IBM Plex Sans",
  lato: "Lato",
  "source-sans-3": "Source Sans 3",
  merriweather: "Merriweather",
  "source-serif-4": "Source Serif 4",
  lora: "Lora",
  "playfair-display": "Playfair Display",
  "jetbrains-mono": "JetBrains Mono",
};

/**
 * Six-digit hex, anchored.
 *
 * This is a security control, not a formatting preference: the accent colour is
 * interpolated into a CSS custom property in the rendered document, so anything
 * that is not exactly a colour must never reach the renderer.
 */
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Palette ids are slugs, matching the id check constraint on `resume_templates`. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Per-resume design choices, stored in `resumes.theme jsonb`.
 *
 * Deliberately thin: a palette id and a handful of overrides. The design itself
 * lives in the template's `tokens`/`palettes`, so a template can be improved
 * without rewriting every resume that uses it.
 */
export const resumeThemeSchema = z.object({
  /** Which of the template's palettes to use. Resolved against the registry. */
  paletteId: z.string().trim().max(64).regex(SLUG_PATTERN, "Invalid palette.").default("default"),
  headingFont: z.enum(RESUME_FONTS).nullable().default(null),
  bodyFont: z.enum(RESUME_FONTS).nullable().default(null),
  /** Overrides the palette's accent. `null` keeps the palette's own. */
  accent: z
    .string()
    .trim()
    .regex(HEX_COLOR_PATTERN, "Use a hex colour like #2563eb.")
    .nullable()
    .default(null),
  /** Body size in points — the unit typographers and print drivers agree on. */
  fontSize: z.number().min(8).max(13).default(10.5),
  lineHeight: z.number().min(1).max(2).default(1.45),
  /** Multiplier on the template's spacing scale. Lets a resume breathe or compress. */
  sectionSpacing: z.number().min(0.5).max(2).default(1),
});

export type ResumeTheme = z.infer<typeof resumeThemeSchema>;

// ── The renderer's input ──────────────────────────────────────────────────────

/**
 * Everything needed to draw a resume, and nothing else.
 *
 * Three columns rather than one nested object, because that is how they are
 * stored and because they change on different cadences — typing edits `content`
 * every keystroke, and nobody changes the page format twice. The preview and the
 * PDF route both take this exact shape, which is what makes "preview and export
 * cannot diverge" a structural guarantee rather than a promise.
 */
export interface ResumeRenderInput {
  document: ResumeDocument;
  theme: ResumeTheme;
  page: ResumePage;
  templateId: string;
}

/**
 * The template a resume gets when nobody has chosen one.
 *
 * Must match `resumes.template_id text not null default 'modern-slate'`. It lives
 * here rather than in the template registry because the store and the editor need a
 * default before the registry is even loaded, and two literals in two files is how
 * a resume ends up rendering with a template id the database never heard of.
 */
export const DEFAULT_TEMPLATE_ID = "modern-slate";

// ── Parsing ───────────────────────────────────────────────────────────────────

export const RESUME_THEME_DEFAULTS: ResumeTheme = resumeThemeSchema.parse({});
export const RESUME_PAGE_DEFAULTS: ResumePage = resumePageSchema.parse({});

export type ResumeDocumentResult =
  { ok: true; document: ResumeDocument } | { ok: false; issues: z.core.$ZodIssue[] };

/**
 * Reads a `resumes.content` value.
 *
 * Returns a result rather than falling back to an empty document, which is the
 * opposite of how `parseAiPreferences` handles a malformed jsonb column — and for
 * a good reason. A bad preferences blob costs the user a dropdown; substituting
 * an empty document for a resume that failed to parse would show them a blank
 * page and then let autosave write that blankness over their work. The caller
 * surfaces the failure and refuses to open the editor.
 */
export function readResumeDocument(value: unknown): ResumeDocumentResult {
  const parsed = resumeDocumentSchema.safeParse(value ?? {});

  return parsed.success
    ? { ok: true, document: parsed.data }
    : { ok: false, issues: parsed.error.issues };
}

/**
 * Theme and page setup are cosmetic, so these do fall back to defaults: a row
 * with a malformed theme should open in the default theme, not refuse to open.
 */
export function readResumeTheme(value: unknown): ResumeTheme {
  const parsed = resumeThemeSchema.safeParse(value ?? {});

  return parsed.success ? parsed.data : RESUME_THEME_DEFAULTS;
}

export function readResumePage(value: unknown): ResumePage {
  const parsed = resumePageSchema.safeParse(value ?? {});

  return parsed.success ? parsed.data : RESUME_PAGE_DEFAULTS;
}

// ── Factories ─────────────────────────────────────────────────────────────────

/**
 * Ids for sections and items.
 *
 * `crypto.randomUUID` rather than a counter or a hash of the content: ids have to
 * be stable across reorders and unique across two browser tabs editing the same
 * resume, and they are generated on the client where a sequence would collide.
 */
export function createResumeId(): string {
  return crypto.randomUUID();
}

const BLANK_ITEMS = {
  experience: (): ExperienceItem => ({
    id: createResumeId(),
    company: "",
    position: "",
    employmentType: "full-time",
    location: "",
    url: "",
    startDate: "",
    endDate: "",
    current: false,
    summary: "",
    highlights: [],
    technologies: [],
  }),
  education: (): EducationItem => ({
    id: createResumeId(),
    institution: "",
    degree: "",
    area: "",
    location: "",
    url: "",
    startDate: "",
    endDate: "",
    current: false,
    grade: "",
    summary: "",
    highlights: [],
  }),
  projects: (): ProjectItem => ({
    id: createResumeId(),
    name: "",
    role: "",
    description: "",
    url: "",
    repoUrl: "",
    startDate: "",
    endDate: "",
    highlights: [],
    technologies: [],
  }),
  skills: (): SkillItem => ({
    id: createResumeId(),
    name: "",
    category: "",
    level: 0,
    keywords: [],
  }),
  languages: (): LanguageItem => ({
    id: createResumeId(),
    name: "",
    proficiency: "professional",
  }),
  certifications: (): CertificationItem => ({
    id: createResumeId(),
    name: "",
    issuer: "",
    issueDate: "",
    expiryDate: "",
    credentialId: "",
    url: "",
  }),
  awards: (): AwardItem => ({
    id: createResumeId(),
    title: "",
    issuer: "",
    date: "",
    summary: "",
  }),
  publications: (): PublicationItem => ({
    id: createResumeId(),
    name: "",
    publisher: "",
    releaseDate: "",
    url: "",
    summary: "",
  }),
  references: (): ReferenceItem => ({
    id: createResumeId(),
    name: "",
    relationship: "",
    company: "",
    email: "",
    phone: "",
    summary: "",
  }),
  interests: (): InterestItem => ({
    id: createResumeId(),
    name: "",
    keywords: [],
  }),
  custom: (): CustomItem => ({
    id: createResumeId(),
    name: "",
    subtitle: "",
    date: "",
    url: "",
    description: "",
    highlights: [],
  }),
} satisfies { [K in ItemSectionKind]: () => ResumeSectionOf<K>["items"][number] };

/**
 * A blank item for a section, typed to that section's kind.
 *
 * The overload-free generic is what lets `RepeatableSection<T>` be written once:
 * the add button calls this with the section's kind and gets back the right item
 * shape without a cast.
 */
export function createSectionItem<TKind extends ItemSectionKind>(
  kind: TKind,
): ResumeSectionOf<TKind>["items"][number] {
  return BLANK_ITEMS[kind]() as ResumeSectionOf<TKind>["items"][number];
}

/**
 * A new, empty section. `title` overrides the kind's default, which is what the
 * "add custom section" flow passes.
 */
export function createSection<TKind extends ResumeSectionKind>(
  kind: TKind,
  title?: string,
): ResumeSectionOf<TKind> {
  const base = {
    id: createResumeId(),
    title: title?.trim() || SECTION_DEFAULT_TITLES[kind],
    visible: true,
  };

  const section =
    kind === "summary" ? { ...base, kind, content: "" } : { ...base, kind, items: [] };

  return section as ResumeSectionOf<TKind>;
}

/**
 * The sections a new resume starts with, in the order recruiters read them.
 *
 * Summary first because it is the only part guaranteed to be read; skills before
 * education because that is the ordering that survives an ATS keyword scan. The
 * long tail (publications, references, interests, custom) is added on demand
 * rather than shipped empty — an empty section is a chore, not a hint.
 */
const STARTER_SECTION_KINDS = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "languages",
  "certifications",
  "awards",
] as const satisfies readonly ResumeSectionKind[];

export interface CreateResumeDocumentInput {
  fullName?: string | null;
  headline?: string | null;
  email?: string | null;
}

/**
 * A starting document, seeded from the user's profile.
 *
 * Prefilling name, headline, and email is the difference between an editor that
 * looks like work and one that looks like it already knows who you are — and all
 * three are values the user has already given us.
 */
export function createResumeDocument(input: CreateResumeDocumentInput = {}): ResumeDocument {
  const basics = resumeBasicsSchema.parse({
    fullName: input.fullName ?? "",
    headline: input.headline ?? "",
    email: input.email ?? "",
  });

  return {
    version: RESUME_DOCUMENT_VERSION,
    basics,
    sections: STARTER_SECTION_KINDS.map((kind) => createSection(kind)),
  };
}

/** An empty document, for tests and for reading a row whose content is `'{}'`. */
export function emptyResumeDocument(): ResumeDocument {
  return resumeDocumentSchema.parse({});
}
