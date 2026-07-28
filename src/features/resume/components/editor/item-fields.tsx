"use client";

/**
 * One field set per section kind, and the dispatch that picks between them.
 *
 * They live in one file because they are one decision: "what does an item of this
 * kind look like". Eleven near-identical files would hide the thing worth seeing,
 * which is how the shapes differ from each other — a job has an employment type and
 * a "current" switch, a certification has an expiry, a skill has a rating.
 *
 * Every component takes the section id and its own item, and writes through
 * `updateItem(kind, …)`. Passing the kind explicitly is what types `patch` against
 * that kind's fields instead of a union that would accept any item's keys.
 *
 * Coalescing keys follow `item:<id>:<field>`. Typing a company name is one undo
 * step; moving to the job title starts another. Without the key, `Cmd+Z` would step
 * back one character at a time.
 */

import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  LANGUAGE_PROFICIENCIES,
  LANGUAGE_PROFICIENCY_LABELS,
  RESUME_LIMITS,
  SKILL_LEVEL_LABELS,
  SKILL_LEVEL_MAX,
  type AwardItem,
  type CertificationItem,
  type CustomItem,
  type EducationItem,
  type ExperienceItem,
  type InterestItem,
  type LanguageItem,
  type ProjectItem,
  type PublicationItem,
  type ReferenceItem,
  type ResumeSection,
  type SkillItem,
} from "@/types/resume";

import { useResumeStore } from "../../store/resume-store";
import { DateField, FieldGrid, SelectField, SwitchField, TextField } from "./editor-fields";
import { BulletListField, KeywordListField } from "./list-fields";
import { RichTextField } from "./rich-text-field";

/** `{ value, label }` pairs for a `Record`-backed vocabulary. */
function optionsFrom<TKey extends string>(
  values: readonly TKey[],
  labels: Record<TKey, string>,
): { value: string; label: string }[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

const EMPLOYMENT_OPTIONS = optionsFrom(EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS);
const PROFICIENCY_OPTIONS = optionsFrom(LANGUAGE_PROFICIENCIES, LANGUAGE_PROFICIENCY_LABELS);
const SKILL_LEVEL_OPTIONS = Array.from({ length: SKILL_LEVEL_MAX + 1 }, (_, level) => ({
  value: String(level),
  label: SKILL_LEVEL_LABELS[level] ?? String(level),
}));

interface ItemFieldsProps<TItem> {
  sectionId: string;
  item: TItem;
}

// ── Experience ────────────────────────────────────────────────────────────────

export function ExperienceFields({ sectionId, item }: ItemFieldsProps<ExperienceItem>) {
  const updateItem = useResumeStore((state) => state.updateItem);

  function patch(next: Partial<ExperienceItem>, field?: string): void {
    updateItem("experience", sectionId, item.id, next, field && `item:${item.id}:${field}`);
  }

  return (
    <>
      <FieldGrid>
        <TextField
          label="Company"
          value={item.company}
          maxLength={RESUME_LIMITS.nameText}
          placeholder="Stripe"
          onChange={(company) => patch({ company }, "company")}
        />
        <TextField
          label="Job title"
          value={item.position}
          maxLength={RESUME_LIMITS.shortText}
          placeholder="Senior Frontend Engineer"
          onChange={(position) => patch({ position }, "position")}
        />
        <SelectField
          label="Employment type"
          value={item.employmentType}
          options={EMPLOYMENT_OPTIONS}
          placeholder="Not specified"
          onChange={(value) => patch({ employmentType: value as ExperienceItem["employmentType"] })}
        />
        <TextField
          label="Location"
          value={item.location}
          maxLength={RESUME_LIMITS.shortText}
          placeholder="Berlin, Germany — Remote"
          onChange={(location) => patch({ location }, "location")}
        />
        <DateField
          label="Start date"
          value={item.startDate}
          onChange={(startDate) => patch({ startDate }, "startDate")}
        />
        <DateField
          label="End date"
          value={item.endDate}
          // Disabled rather than hidden: the stored value is kept, so unchecking
          // "current role" brings the old end date back instead of losing it.
          disabled={item.current}
          hint={item.current ? "Templates print “Present”." : undefined}
          onChange={(endDate) => patch({ endDate }, "endDate")}
        />
      </FieldGrid>

      <SwitchField
        label="This is my current role"
        checked={item.current}
        onChange={(current) => patch({ current })}
      />

      <RichTextField
        label="Summary"
        value={item.summary}
        maxLength={RESUME_LIMITS.itemRichText}
        placeholder="One or two lines on scope: team size, systems owned, what you were accountable for."
        onChange={(summary) => patch({ summary }, "summary")}
      />

      <BulletListField
        label="Highlights"
        value={item.highlights}
        maxItems={RESUME_LIMITS.highlightsPerItem}
        maxLength={RESUME_LIMITS.highlightText}
        placeholder="Cut checkout latency 40% by moving validation to the edge."
        onChange={(highlights) => patch({ highlights })}
      />

      <KeywordListField
        label="Technologies"
        value={item.technologies}
        maxItems={RESUME_LIMITS.technologiesPerItem}
        maxLength={RESUME_LIMITS.keywordText}
        placeholder="TypeScript, Postgres, Terraform"
        hint="Press Enter or comma after each one. These are what keyword scans look for."
        onChange={(technologies) => patch({ technologies })}
      />
    </>
  );
}

// ── Education ─────────────────────────────────────────────────────────────────

export function EducationFields({ sectionId, item }: ItemFieldsProps<EducationItem>) {
  const updateItem = useResumeStore((state) => state.updateItem);

  function patch(next: Partial<EducationItem>, field?: string): void {
    updateItem("education", sectionId, item.id, next, field && `item:${item.id}:${field}`);
  }

  return (
    <>
      <FieldGrid>
        <TextField
          label="Institution"
          value={item.institution}
          maxLength={RESUME_LIMITS.nameText}
          placeholder="Technical University of Munich"
          onChange={(institution) => patch({ institution }, "institution")}
        />
        <TextField
          label="Degree"
          value={item.degree}
          maxLength={RESUME_LIMITS.shortText}
          placeholder="BSc"
          onChange={(degree) => patch({ degree }, "degree")}
        />
        <TextField
          label="Field of study"
          value={item.area}
          maxLength={RESUME_LIMITS.shortText}
          placeholder="Computer Science"
          onChange={(area) => patch({ area }, "area")}
        />
        <TextField
          label="Grade"
          value={item.grade}
          maxLength={RESUME_LIMITS.nameText}
          placeholder="1.3 / First class"
          onChange={(grade) => patch({ grade }, "grade")}
        />
        <DateField
          label="Start date"
          value={item.startDate}
          onChange={(startDate) => patch({ startDate }, "startDate")}
        />
        <DateField
          label="End date"
          value={item.endDate}
          disabled={item.current}
          hint={item.current ? "Templates print “Present”." : undefined}
          onChange={(endDate) => patch({ endDate }, "endDate")}
        />
      </FieldGrid>

      <SwitchField
        label="Still studying here"
        checked={item.current}
        onChange={(current) => patch({ current })}
      />

      <RichTextField
        label="Summary"
        value={item.summary}
        maxLength={RESUME_LIMITS.itemRichText}
        placeholder="Thesis topic, focus areas, anything a hiring manager would ask about."
        onChange={(summary) => patch({ summary }, "summary")}
      />

      <BulletListField
        label="Highlights"
        value={item.highlights}
        maxItems={RESUME_LIMITS.highlightsPerItem}
        maxLength={RESUME_LIMITS.highlightText}
        placeholder="Graduated top 5% of a 200-student cohort."
        onChange={(highlights) => patch({ highlights })}
      />
    </>
  );
}

// ── Projects ──────────────────────────────────────────────────────────────────

export function ProjectFields({ sectionId, item }: ItemFieldsProps<ProjectItem>) {
  const updateItem = useResumeStore((state) => state.updateItem);

  function patch(next: Partial<ProjectItem>, field?: string): void {
    updateItem("projects", sectionId, item.id, next, field && `item:${item.id}:${field}`);
  }

  return (
    <>
      <FieldGrid>
        <TextField
          label="Project"
          value={item.name}
          maxLength={RESUME_LIMITS.nameText}
          placeholder="Reforge"
          onChange={(name) => patch({ name }, "name")}
        />
        <TextField
          label="Your role"
          value={item.role}
          maxLength={RESUME_LIMITS.shortText}
          placeholder="Creator / Maintainer"
          onChange={(role) => patch({ role }, "role")}
        />
        <TextField
          label="Link"
          type="url"
          value={item.url}
          maxLength={RESUME_LIMITS.urlText}
          placeholder="https://example.com"
          onChange={(url) => patch({ url }, "url")}
        />
        <TextField
          label="Repository"
          type="url"
          value={item.repoUrl}
          maxLength={RESUME_LIMITS.urlText}
          placeholder="https://github.com/you/project"
          onChange={(repoUrl) => patch({ repoUrl }, "repoUrl")}
        />
        <DateField
          label="Start date"
          value={item.startDate}
          onChange={(startDate) => patch({ startDate }, "startDate")}
        />
        <DateField
          label="End date"
          value={item.endDate}
          onChange={(endDate) => patch({ endDate }, "endDate")}
        />
      </FieldGrid>

      <RichTextField
        label="Description"
        value={item.description}
        maxLength={RESUME_LIMITS.itemRichText}
        placeholder="What it does and who it is for, in one sentence."
        onChange={(description) => patch({ description }, "description")}
      />

      <BulletListField
        label="Highlights"
        value={item.highlights}
        maxItems={RESUME_LIMITS.highlightsPerItem}
        maxLength={RESUME_LIMITS.highlightText}
        placeholder="4k GitHub stars and 30k monthly downloads."
        onChange={(highlights) => patch({ highlights })}
      />

      <KeywordListField
        label="Technologies"
        value={item.technologies}
        maxItems={RESUME_LIMITS.technologiesPerItem}
        maxLength={RESUME_LIMITS.keywordText}
        placeholder="Next.js, Supabase"
        onChange={(technologies) => patch({ technologies })}
      />
    </>
  );
}

// ── Skills ────────────────────────────────────────────────────────────────────

export function SkillFields({ sectionId, item }: ItemFieldsProps<SkillItem>) {
  const updateItem = useResumeStore((state) => state.updateItem);

  function patch(next: Partial<SkillItem>, field?: string): void {
    updateItem("skills", sectionId, item.id, next, field && `item:${item.id}:${field}`);
  }

  return (
    <>
      <FieldGrid>
        <TextField
          label="Skill"
          value={item.name}
          maxLength={RESUME_LIMITS.nameText}
          placeholder="TypeScript"
          onChange={(name) => patch({ name }, "name")}
        />
        <TextField
          label="Category"
          value={item.category}
          maxLength={RESUME_LIMITS.nameText}
          placeholder="Languages"
          hint="Skills sharing a category are grouped by most templates."
          onChange={(category) => patch({ category }, "category")}
        />
      </FieldGrid>

      <SelectField
        label="Level"
        value={String(item.level)}
        options={SKILL_LEVEL_OPTIONS}
        placeholder="Not rated"
        // `Number()` and not `parseInt`: the value comes from our own option list,
        // and the schema requires an integer 0–5, so a NaN here would fail at save
        // time rather than at the click.
        onChange={(value) => patch({ level: Number(value) || 0 })}
      />

      <KeywordListField
        label="Related keywords"
        value={item.keywords}
        maxItems={RESUME_LIMITS.keywordsPerItem}
        maxLength={RESUME_LIMITS.keywordText}
        placeholder="tRPC, Zod"
        onChange={(keywords) => patch({ keywords })}
      />
    </>
  );
}

// ── Languages ─────────────────────────────────────────────────────────────────

export function LanguageFields({ sectionId, item }: ItemFieldsProps<LanguageItem>) {
  const updateItem = useResumeStore((state) => state.updateItem);

  function patch(next: Partial<LanguageItem>, field?: string): void {
    updateItem("languages", sectionId, item.id, next, field && `item:${item.id}:${field}`);
  }

  return (
    <FieldGrid>
      <TextField
        label="Language"
        value={item.name}
        maxLength={RESUME_LIMITS.nameText}
        placeholder="Arabic"
        onChange={(name) => patch({ name }, "name")}
      />
      <SelectField
        label="Proficiency"
        value={item.proficiency}
        options={PROFICIENCY_OPTIONS}
        placeholder="Not specified"
        onChange={(value) => patch({ proficiency: value as LanguageItem["proficiency"] })}
      />
    </FieldGrid>
  );
}

// ── Certifications ────────────────────────────────────────────────────────────

export function CertificationFields({ sectionId, item }: ItemFieldsProps<CertificationItem>) {
  const updateItem = useResumeStore((state) => state.updateItem);

  function patch(next: Partial<CertificationItem>, field?: string): void {
    updateItem("certifications", sectionId, item.id, next, field && `item:${item.id}:${field}`);
  }

  return (
    <>
      <FieldGrid>
        <TextField
          label="Certification"
          value={item.name}
          maxLength={RESUME_LIMITS.shortText}
          placeholder="AWS Solutions Architect — Professional"
          onChange={(name) => patch({ name }, "name")}
        />
        <TextField
          label="Issuer"
          value={item.issuer}
          maxLength={RESUME_LIMITS.nameText}
          placeholder="Amazon Web Services"
          onChange={(issuer) => patch({ issuer }, "issuer")}
        />
        <DateField
          label="Issued"
          value={item.issueDate}
          onChange={(issueDate) => patch({ issueDate }, "issueDate")}
        />
        <DateField
          label="Expires"
          value={item.expiryDate}
          hint="Leave empty if it does not expire."
          onChange={(expiryDate) => patch({ expiryDate }, "expiryDate")}
        />
        <TextField
          label="Credential ID"
          value={item.credentialId}
          maxLength={RESUME_LIMITS.nameText}
          onChange={(credentialId) => patch({ credentialId }, "credentialId")}
        />
        <TextField
          label="Verification link"
          type="url"
          value={item.url}
          maxLength={RESUME_LIMITS.urlText}
          placeholder="https://credly.com/badges/…"
          onChange={(url) => patch({ url }, "url")}
        />
      </FieldGrid>
    </>
  );
}

// ── Awards ────────────────────────────────────────────────────────────────────

export function AwardFields({ sectionId, item }: ItemFieldsProps<AwardItem>) {
  const updateItem = useResumeStore((state) => state.updateItem);

  function patch(next: Partial<AwardItem>, field?: string): void {
    updateItem("awards", sectionId, item.id, next, field && `item:${item.id}:${field}`);
  }

  return (
    <>
      <FieldGrid>
        <TextField
          label="Award"
          value={item.title}
          maxLength={RESUME_LIMITS.shortText}
          placeholder="Engineering Excellence Award"
          onChange={(title) => patch({ title }, "title")}
        />
        <TextField
          label="Awarded by"
          value={item.issuer}
          maxLength={RESUME_LIMITS.nameText}
          onChange={(issuer) => patch({ issuer }, "issuer")}
        />
        <DateField label="Date" value={item.date} onChange={(date) => patch({ date }, "date")} />
      </FieldGrid>

      <RichTextField
        label="Summary"
        value={item.summary}
        maxLength={RESUME_LIMITS.itemRichText}
        placeholder="What it was for, and how many people were eligible."
        onChange={(summary) => patch({ summary }, "summary")}
      />
    </>
  );
}

// ── Publications ──────────────────────────────────────────────────────────────

export function PublicationFields({ sectionId, item }: ItemFieldsProps<PublicationItem>) {
  const updateItem = useResumeStore((state) => state.updateItem);

  function patch(next: Partial<PublicationItem>, field?: string): void {
    updateItem("publications", sectionId, item.id, next, field && `item:${item.id}:${field}`);
  }

  return (
    <>
      <FieldGrid>
        <TextField
          label="Title"
          value={item.name}
          maxLength={RESUME_LIMITS.shortText}
          onChange={(name) => patch({ name }, "name")}
        />
        <TextField
          label="Publisher"
          value={item.publisher}
          maxLength={RESUME_LIMITS.nameText}
          placeholder="ACM SIGCHI"
          onChange={(publisher) => patch({ publisher }, "publisher")}
        />
        <DateField
          label="Released"
          value={item.releaseDate}
          onChange={(releaseDate) => patch({ releaseDate }, "releaseDate")}
        />
        <TextField
          label="Link"
          type="url"
          value={item.url}
          maxLength={RESUME_LIMITS.urlText}
          placeholder="https://doi.org/…"
          onChange={(url) => patch({ url }, "url")}
        />
      </FieldGrid>

      <RichTextField
        label="Summary"
        value={item.summary}
        maxLength={RESUME_LIMITS.itemRichText}
        onChange={(summary) => patch({ summary }, "summary")}
      />
    </>
  );
}

// ── References ────────────────────────────────────────────────────────────────

export function ReferenceFields({ sectionId, item }: ItemFieldsProps<ReferenceItem>) {
  const updateItem = useResumeStore((state) => state.updateItem);

  function patch(next: Partial<ReferenceItem>, field?: string): void {
    updateItem("references", sectionId, item.id, next, field && `item:${item.id}:${field}`);
  }

  return (
    <>
      <FieldGrid>
        <TextField
          label="Name"
          value={item.name}
          maxLength={RESUME_LIMITS.nameText}
          onChange={(name) => patch({ name }, "name")}
        />
        <TextField
          label="Relationship"
          value={item.relationship}
          maxLength={RESUME_LIMITS.shortText}
          placeholder="Former manager"
          onChange={(relationship) => patch({ relationship }, "relationship")}
        />
        <TextField
          label="Company"
          value={item.company}
          maxLength={RESUME_LIMITS.nameText}
          onChange={(company) => patch({ company }, "company")}
        />
        <TextField
          label="Email"
          type="email"
          value={item.email}
          maxLength={RESUME_LIMITS.shortText}
          onChange={(email) => patch({ email }, "email")}
        />
        <TextField
          label="Phone"
          type="tel"
          value={item.phone}
          maxLength={RESUME_LIMITS.phoneText}
          onChange={(phone) => patch({ phone }, "phone")}
        />
      </FieldGrid>

      <RichTextField
        label="Note"
        value={item.summary}
        maxLength={RESUME_LIMITS.itemRichText}
        placeholder="Most resumes are better off with “References available on request”."
        onChange={(summary) => patch({ summary }, "summary")}
      />
    </>
  );
}

// ── Interests ─────────────────────────────────────────────────────────────────

export function InterestFields({ sectionId, item }: ItemFieldsProps<InterestItem>) {
  const updateItem = useResumeStore((state) => state.updateItem);

  function patch(next: Partial<InterestItem>, field?: string): void {
    updateItem("interests", sectionId, item.id, next, field && `item:${item.id}:${field}`);
  }

  return (
    <>
      <TextField
        label="Interest"
        value={item.name}
        maxLength={RESUME_LIMITS.nameText}
        placeholder="Long-distance cycling"
        onChange={(name) => patch({ name }, "name")}
      />

      <KeywordListField
        label="Details"
        value={item.keywords}
        maxItems={RESUME_LIMITS.keywordsPerItem}
        maxLength={RESUME_LIMITS.keywordText}
        placeholder="Alps, 200km audax"
        onChange={(keywords) => patch({ keywords })}
      />
    </>
  );
}

// ── Custom ────────────────────────────────────────────────────────────────────

export function CustomFields({ sectionId, item }: ItemFieldsProps<CustomItem>) {
  const updateItem = useResumeStore((state) => state.updateItem);

  function patch(next: Partial<CustomItem>, field?: string): void {
    updateItem("custom", sectionId, item.id, next, field && `item:${item.id}:${field}`);
  }

  return (
    <>
      <FieldGrid>
        <TextField
          label="Title"
          value={item.name}
          maxLength={RESUME_LIMITS.shortText}
          onChange={(name) => patch({ name }, "name")}
        />
        <TextField
          label="Subtitle"
          value={item.subtitle}
          maxLength={RESUME_LIMITS.shortText}
          onChange={(subtitle) => patch({ subtitle }, "subtitle")}
        />
        <DateField label="Date" value={item.date} onChange={(date) => patch({ date }, "date")} />
        <TextField
          label="Link"
          type="url"
          value={item.url}
          maxLength={RESUME_LIMITS.urlText}
          onChange={(url) => patch({ url }, "url")}
        />
      </FieldGrid>

      <RichTextField
        label="Description"
        value={item.description}
        maxLength={RESUME_LIMITS.itemRichText}
        onChange={(description) => patch({ description }, "description")}
      />

      <BulletListField
        label="Highlights"
        value={item.highlights}
        maxItems={RESUME_LIMITS.highlightsPerItem}
        maxLength={RESUME_LIMITS.highlightText}
        onChange={(highlights) => patch({ highlights })}
      />
    </>
  );
}

// ── Collapsed-row summaries ───────────────────────────────────────────────────

/**
 * What a collapsed item row shows.
 *
 * Kept beside the field sets on purpose: the summary has to name the fields a user
 * would recognise the item by, so it changes whenever the fields do. A generic
 * `item.name ?? item.title` would say "Untitled" for half the kinds.
 */
export type ItemSummary = { title: string; subtitle?: string };

/** Joins the parts that are filled in, so nothing renders as "— at —". */
function joinParts(...parts: (string | undefined)[]): string {
  return parts
    .map((part) => part?.trim())
    .filter((part) => part && part.length > 0)
    .join(" · ");
}

export function summarizeItem(section: ResumeSection, item: { id: string }): ItemSummary {
  switch (section.kind) {
    case "summary":
      // Not a list; `RepeatableSection` is never rendered for it.
      return { title: section.title };
    case "experience": {
      const job = item as ExperienceItem;

      return {
        title: joinParts(job.position, job.company) || "",
        subtitle: joinParts(
          job.startDate ? `${job.startDate} – ${job.current ? "Present" : job.endDate || "?"}` : "",
          job.location,
        ),
      };
    }
    case "education": {
      const study = item as EducationItem;

      return {
        title: joinParts(study.degree, study.area) || study.institution,
        subtitle: joinParts(
          study.institution === joinParts(study.degree, study.area) ? "" : study.institution,
          study.startDate
            ? `${study.startDate} – ${study.current ? "Present" : study.endDate || "?"}`
            : "",
        ),
      };
    }
    case "projects": {
      const project = item as ProjectItem;

      return { title: project.name, subtitle: joinParts(project.role, project.url) };
    }
    case "skills": {
      const skill = item as SkillItem;

      return {
        title: skill.name,
        subtitle: joinParts(skill.category, skill.level > 0 ? SKILL_LEVEL_LABELS[skill.level] : ""),
      };
    }
    case "languages": {
      const language = item as LanguageItem;

      return {
        title: language.name,
        subtitle: language.proficiency ? LANGUAGE_PROFICIENCY_LABELS[language.proficiency] : "",
      };
    }
    case "certifications": {
      const certification = item as CertificationItem;

      return {
        title: certification.name,
        subtitle: joinParts(certification.issuer, certification.issueDate),
      };
    }
    case "awards": {
      const award = item as AwardItem;

      return { title: award.title, subtitle: joinParts(award.issuer, award.date) };
    }
    case "publications": {
      const publication = item as PublicationItem;

      return {
        title: publication.name,
        subtitle: joinParts(publication.publisher, publication.releaseDate),
      };
    }
    case "references": {
      const reference = item as ReferenceItem;

      return {
        title: reference.name,
        subtitle: joinParts(reference.relationship, reference.company),
      };
    }
    case "interests": {
      const interest = item as InterestItem;

      return { title: interest.name, subtitle: interest.keywords.join(", ") };
    }
    case "custom": {
      const entry = item as CustomItem;

      return { title: entry.name, subtitle: joinParts(entry.subtitle, entry.date) };
    }
  }
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

/**
 * Renders the right field set for an item.
 *
 * `section` is the discriminated union, so narrowing it here is what lets each
 * branch pass a correctly-typed item down. The cast on `item` is the one piece
 * TypeScript cannot do for us: the item was pulled from `section.items` by the
 * caller and has already lost the correlation.
 */
export function ItemFields({ section, item }: { section: ResumeSection; item: { id: string } }) {
  switch (section.kind) {
    case "summary":
      return null;
    case "experience":
      return <ExperienceFields sectionId={section.id} item={item as ExperienceItem} />;
    case "education":
      return <EducationFields sectionId={section.id} item={item as EducationItem} />;
    case "projects":
      return <ProjectFields sectionId={section.id} item={item as ProjectItem} />;
    case "skills":
      return <SkillFields sectionId={section.id} item={item as SkillItem} />;
    case "languages":
      return <LanguageFields sectionId={section.id} item={item as LanguageItem} />;
    case "certifications":
      return <CertificationFields sectionId={section.id} item={item as CertificationItem} />;
    case "awards":
      return <AwardFields sectionId={section.id} item={item as AwardItem} />;
    case "publications":
      return <PublicationFields sectionId={section.id} item={item as PublicationItem} />;
    case "references":
      return <ReferenceFields sectionId={section.id} item={item as ReferenceItem} />;
    case "interests":
      return <InterestFields sectionId={section.id} item={item as InterestItem} />;
    case "custom":
      return <CustomFields sectionId={section.id} item={item as CustomItem} />;
  }
}

/** The noun used in "Add …", "Remove …", and the drag announcements. */
export const ITEM_NOUNS: Record<Exclude<ResumeSection["kind"], "summary">, string> = {
  experience: "job",
  education: "qualification",
  projects: "project",
  skills: "skill",
  languages: "language",
  certifications: "certification",
  awards: "award",
  publications: "publication",
  references: "reference",
  interests: "interest",
  custom: "entry",
};

/** Shown in place of the list when a section has no items yet. */
export const ITEM_EMPTY_HINTS: Record<Exclude<ResumeSection["kind"], "summary">, string> = {
  experience: "Add your most recent job first. Two or three bullets each beats a paragraph.",
  education: "Degrees, diplomas, bootcamps — most recent first.",
  projects: "Work you can point at. Side projects count, especially early in a career.",
  skills: "The tools you would be comfortable being asked about in an interview.",
  languages: "Languages you can work in, with an honest level.",
  certifications: "Credentials with an issuer and a date. Skip anything expired and unrenewed.",
  awards: "Recognition worth a line. Include the field you were competing in.",
  publications: "Papers, articles, talks with proceedings.",
  references: "Only if a posting asks for them by name.",
  interests: "Two or three, kept short. This section is a conversation starter, not a biography.",
  custom: "Anything the other sections do not cover — patents, service, coursework.",
};
