/**
 * One block per section kind.
 *
 * The switch in `SectionBlock` is exhaustive over `ResumeSection["kind"]` and returns
 * `never` in its default arm, so adding a 13th kind to the schema is a compile error here
 * rather than a section that silently prints nothing.
 *
 * Two rules hold across all of them:
 *
 * 1. **An empty section prints nothing at all**, heading included — `isSectionEmpty`
 *    decides, not each block. A resume with an "Awards" heading and no awards reads as
 *    unfinished, and the editor deliberately ships several sections empty.
 * 2. **Every field is optional in practice.** A user is mid-typing, so a block must look
 *    deliberate with only one of its fields filled. That is why titles, metadata, and
 *    dates are composed through `joinMeta` and conditional renders rather than fixed
 *    templates like `${degree}, ${area}`.
 */

import type {
  AwardItem,
  CertificationItem,
  CustomItem,
  EducationItem,
  ExperienceItem,
  InterestItem,
  LanguageItem,
  ProjectItem,
  PublicationItem,
  ReferenceItem,
  ResumeSection,
  SkillItem,
} from "@/types/resume";
import {
  EMPLOYMENT_TYPE_LABELS,
  LANGUAGE_PROFICIENCY_LABELS,
  SKILL_LEVEL_LABELS,
} from "@/types/resume";
import { isRichTextEmpty } from "@/utils/rich-text";

import { formatResumeDate, formatResumeDateRange } from "../lib/format-resume-date";
import {
  Bullets,
  ExternalLink,
  headingFont,
  ItemHeader,
  ItemList,
  ItemShell,
  joinMeta,
  LevelMeter,
  RichText,
  SectionShell,
  Tags,
  type TemplatePartProps,
} from "./resume-atoms";

/**
 * Whether a section would render as a heading and nothing else.
 *
 * Item sections check for items rather than for content inside them: a user who has just
 * clicked "add experience" should see the entry appear in the preview even while every
 * field is still blank, because that is the feedback that the click worked.
 */
export function isSectionEmpty(section: ResumeSection): boolean {
  return section.kind === "summary" ? isRichTextEmpty(section.content) : section.items.length === 0;
}

export function isSectionRendered(section: ResumeSection): boolean {
  return section.visible && !isSectionEmpty(section);
}

export interface SectionBlockProps extends TemplatePartProps {
  section: ResumeSection;
}

export function SectionBlock({ template, section }: SectionBlockProps) {
  if (!isSectionRendered(section)) {
    return null;
  }

  return (
    <SectionShell template={template} title={section.title}>
      {sectionBody({ template, section })}
    </SectionShell>
  );
}

function sectionBody({ template, section }: SectionBlockProps) {
  const divider = template.definition.tokens.itemDivider;

  switch (section.kind) {
    case "summary":
      return <RichText template={template} html={section.content} />;

    case "experience":
      return (
        <ItemList template={template}>
          {section.items.map((item, index) => (
            <ExperienceBlock
              key={item.id}
              template={template}
              item={item}
              divider={divider && index > 0}
            />
          ))}
        </ItemList>
      );

    case "education":
      return (
        <ItemList template={template}>
          {section.items.map((item, index) => (
            <EducationBlock
              key={item.id}
              template={template}
              item={item}
              divider={divider && index > 0}
            />
          ))}
        </ItemList>
      );

    case "projects":
      return (
        <ItemList template={template}>
          {section.items.map((item, index) => (
            <ProjectBlock
              key={item.id}
              template={template}
              item={item}
              divider={divider && index > 0}
            />
          ))}
        </ItemList>
      );

    case "skills":
      return <SkillsBlock template={template} items={section.items} />;

    case "languages":
      return <LanguagesBlock template={template} items={section.items} />;

    case "certifications":
      return (
        <ItemList template={template}>
          {section.items.map((item, index) => (
            <CertificationBlock
              key={item.id}
              template={template}
              item={item}
              divider={divider && index > 0}
            />
          ))}
        </ItemList>
      );

    case "awards":
      return (
        <ItemList template={template}>
          {section.items.map((item, index) => (
            <AwardBlock
              key={item.id}
              template={template}
              item={item}
              divider={divider && index > 0}
            />
          ))}
        </ItemList>
      );

    case "publications":
      return (
        <ItemList template={template}>
          {section.items.map((item, index) => (
            <PublicationBlock
              key={item.id}
              template={template}
              item={item}
              divider={divider && index > 0}
            />
          ))}
        </ItemList>
      );

    case "references":
      return (
        <ItemList template={template}>
          {section.items.map((item, index) => (
            <ReferenceBlock
              key={item.id}
              template={template}
              item={item}
              divider={divider && index > 0}
            />
          ))}
        </ItemList>
      );

    case "interests":
      return <InterestsBlock template={template} items={section.items} />;

    case "custom":
      return (
        <ItemList template={template}>
          {section.items.map((item, index) => (
            <CustomBlock
              key={item.id}
              template={template}
              item={item}
              divider={divider && index > 0}
            />
          ))}
        </ItemList>
      );

    default: {
      // Exhaustiveness check: a new section kind fails to compile here.
      const unhandled: never = section;
      return unhandled;
    }
  }
}

interface ItemBlockProps<TItem> extends TemplatePartProps {
  item: TItem;
  divider: boolean;
}

function ExperienceBlock({ template, item, divider }: ItemBlockProps<ExperienceItem>) {
  const employment = item.employmentType ? EMPLOYMENT_TYPE_LABELS[item.employmentType] : "";

  return (
    <ItemShell template={template} divider={divider}>
      <ItemHeader
        template={template}
        title={item.position || item.company}
        meta={
          item.position && item.company ? (
            <>
              {item.url ? (
                <ExternalLink template={template} href={item.url}>
                  {item.company}
                </ExternalLink>
              ) : (
                item.company
              )}
              {joinMeta([employment, item.location])
                ? ` · ${joinMeta([employment, item.location])}`
                : ""}
            </>
          ) : (
            joinMeta([employment, item.location]) || undefined
          )
        }
        aside={formatResumeDateRange(item)}
      />
      <RichText template={template} html={item.summary} />
      <Bullets template={template} items={item.highlights} />
      <Tags template={template} values={item.technologies} />
    </ItemShell>
  );
}

function EducationBlock({ template, item, divider }: ItemBlockProps<EducationItem>) {
  const study = joinMeta([item.degree, item.area]);

  return (
    <ItemShell template={template} divider={divider}>
      <ItemHeader
        template={template}
        title={study || item.institution}
        meta={joinMeta([study ? item.institution : "", item.location, item.grade]) || undefined}
        aside={formatResumeDateRange(item)}
      />
      <RichText template={template} html={item.summary} />
      <Bullets template={template} items={item.highlights} />
    </ItemShell>
  );
}

function ProjectBlock({ template, item, divider }: ItemBlockProps<ProjectItem>) {
  const links = [item.url, item.repoUrl].filter(Boolean);

  return (
    <ItemShell template={template} divider={divider}>
      <ItemHeader
        template={template}
        title={item.name}
        meta={
          item.role || links.length > 0 ? (
            <span
              style={{ display: "inline-flex", flexWrap: "wrap", gap: template.spacing.blockGapPx }}
            >
              {item.role ? <span>{item.role}</span> : null}
              {links.map((href) => (
                <ExternalLink key={href} template={template} href={href} />
              ))}
            </span>
          ) : undefined
        }
        aside={formatResumeDateRange({ startDate: item.startDate, endDate: item.endDate })}
      />
      <RichText template={template} html={item.description} />
      <Bullets template={template} items={item.highlights} />
      <Tags template={template} values={item.technologies} />
    </ItemShell>
  );
}

/**
 * Skills group by their free-text `category`, in first-seen order — alphabetizing would
 * reorder a list the user arranged deliberately. Uncategorized skills fall into one
 * unlabelled group so a resume that never uses categories reads as a plain list.
 */
function SkillsBlock({ template, items }: TemplatePartProps & { items: readonly SkillItem[] }) {
  const groups = new Map<string, SkillItem[]>();

  for (const item of items) {
    const key = item.category.trim();
    const group = groups.get(key);

    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: template.spacing.itemGapPx }}>
      {[...groups].map(([category, group]) => (
        <div
          key={category}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: template.spacing.blockGapPx,
            breakInside: "avoid",
          }}
        >
          {category ? (
            <p
              style={{ ...headingFont(template), color: template.colors.heading, fontWeight: 600 }}
            >
              {category}
            </p>
          ) : null}
          {group.map((item) => (
            <SkillRow key={item.id} template={template} item={item} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SkillRow({ template, item }: TemplatePartProps & { item: SkillItem }) {
  const keywords = item.keywords.filter((keyword) => keyword.trim().length > 0);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        gap: template.spacing.blockGapPx * 2,
      }}
    >
      {item.name ? <span style={{ color: template.colors.body }}>{item.name}</span> : null}
      {keywords.length > 0 ? (
        <span style={{ color: template.colors.muted }}>{keywords.join(", ")}</span>
      ) : null}
      <LevelMeter
        template={template}
        level={item.level}
        label={`${item.name || "Skill"}: ${SKILL_LEVEL_LABELS[item.level] ?? ""}`}
      />
    </div>
  );
}

function LanguagesBlock({
  template,
  items,
}: TemplatePartProps & { items: readonly LanguageItem[] }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: `${template.spacing.blockGapPx}px ${template.spacing.itemGapPx * 2}px`,
      }}
    >
      {items.map((item) => (
        <p key={item.id} style={{ color: template.colors.body }}>
          {item.name}
          {item.proficiency ? (
            <span style={{ color: template.colors.muted }}>
              {" — "}
              {LANGUAGE_PROFICIENCY_LABELS[item.proficiency]}
            </span>
          ) : null}
        </p>
      ))}
    </div>
  );
}

function CertificationBlock({ template, item, divider }: ItemBlockProps<CertificationItem>) {
  const validity = item.expiryDate
    ? formatResumeDateRange({ startDate: item.issueDate, endDate: item.expiryDate })
    : formatResumeDate(item.issueDate);

  return (
    <ItemShell template={template} divider={divider}>
      <ItemHeader
        template={template}
        title={
          item.url ? (
            <ExternalLink template={template} href={item.url}>
              {item.name}
            </ExternalLink>
          ) : (
            item.name
          )
        }
        meta={joinMeta([item.issuer, item.credentialId]) || undefined}
        aside={validity}
      />
    </ItemShell>
  );
}

function AwardBlock({ template, item, divider }: ItemBlockProps<AwardItem>) {
  return (
    <ItemShell template={template} divider={divider}>
      <ItemHeader
        template={template}
        title={item.title}
        meta={item.issuer || undefined}
        aside={formatResumeDate(item.date)}
      />
      <RichText template={template} html={item.summary} />
    </ItemShell>
  );
}

function PublicationBlock({ template, item, divider }: ItemBlockProps<PublicationItem>) {
  return (
    <ItemShell template={template} divider={divider}>
      <ItemHeader
        template={template}
        title={
          item.url ? (
            <ExternalLink template={template} href={item.url}>
              {item.name}
            </ExternalLink>
          ) : (
            item.name
          )
        }
        meta={item.publisher || undefined}
        aside={formatResumeDate(item.releaseDate)}
      />
      <RichText template={template} html={item.summary} />
    </ItemShell>
  );
}

function ReferenceBlock({ template, item, divider }: ItemBlockProps<ReferenceItem>) {
  return (
    <ItemShell template={template} divider={divider}>
      <ItemHeader
        template={template}
        title={item.name}
        meta={joinMeta([item.relationship, item.company]) || undefined}
        aside={joinMeta([item.email, item.phone]) || undefined}
      />
      <RichText template={template} html={item.summary} />
    </ItemShell>
  );
}

function InterestsBlock({
  template,
  items,
}: TemplatePartProps & { items: readonly InterestItem[] }) {
  return (
    <p style={{ color: template.colors.body }}>
      {items
        .map((item) =>
          [item.name, item.keywords.filter(Boolean).join(", ")].filter(Boolean).join(": "),
        )
        .filter(Boolean)
        .join(" · ")}
    </p>
  );
}

function CustomBlock({ template, item, divider }: ItemBlockProps<CustomItem>) {
  return (
    <ItemShell template={template} divider={divider}>
      <ItemHeader
        template={template}
        title={
          item.url ? (
            <ExternalLink template={template} href={item.url}>
              {item.name}
            </ExternalLink>
          ) : (
            item.name
          )
        }
        meta={item.subtitle || undefined}
        aside={formatResumeDate(item.date)}
      />
      <RichText template={template} html={item.description} />
      <Bullets template={template} items={item.highlights} />
    </ItemShell>
  );
}
