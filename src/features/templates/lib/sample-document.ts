/**
 * The document every template is previewed with.
 *
 * A gallery thumbnail has to answer "what does this template look like?", and an empty
 * resume answers nothing — twenty blank pages differ only in their margins. So the
 * gallery renders a fictional person through the real renderer: same `ResumeRenderInput`
 * the editor and the PDF route use, which is what keeps a thumbnail honest when a layout
 * changes.
 *
 * The content is chosen to exercise the parts that differ between layouts rather than to
 * read well: a headline and contact line for the header treatments, two dated experience
 * items with bullets for the timeline, grouped skills and languages because the sidebar
 * layouts fill their column with them, and one project so the two-column layouts have a
 * second block to balance. Longer than that and the thumbnail becomes grey noise; shorter
 * and half the layouts render an empty column.
 *
 * Every item is spread over `createSectionItem`, so a new required field on an item schema
 * arrives here with its blank value instead of failing to compile — and the whole document
 * is `parse`d, not asserted, so a fixture that drifts out of the schema fails loudly at
 * import rather than rendering something the editor could never produce.
 */

import {
  createSectionItem,
  RESUME_PAGE_DEFAULTS,
  RESUME_THEME_DEFAULTS,
  resumeDocumentSchema,
  type ResumeDocument,
  type ResumePage,
  type ResumeRenderInput,
  type ResumeTheme,
} from "@/types/resume";

/**
 * Ids are literal, not generated. `crypto.randomUUID()` at module scope would give the
 * server and any re-render different keys for the same fixture, and a stable fixture is
 * also a stable snapshot in tests.
 */
const sampleDocument: ResumeDocument = resumeDocumentSchema.parse({
  basics: {
    fullName: "Amara Osei",
    headline: "Senior Product Engineer",
    email: "amara.osei@example.com",
    phone: "+44 20 7946 0812",
    location: "London, UK",
    website: "https://amaraosei.example.com",
    socials: [
      {
        id: "sample-social-github",
        network: "GitHub",
        username: "amaraosei",
        url: "https://github.com/amaraosei",
      },
      {
        id: "sample-social-linkedin",
        network: "LinkedIn",
        username: "amaraosei",
        url: "https://www.linkedin.com/in/amaraosei",
      },
    ],
  },
  sections: [
    {
      id: "sample-section-summary",
      kind: "summary",
      title: "Summary",
      content:
        "<p>Product engineer with eight years building customer-facing platforms at scale. " +
        "Leads design-partnered delivery, mentors mid-level engineers, and keeps performance " +
        "budgets a shipping requirement rather than a retrospective.</p>",
    },
    {
      id: "sample-section-experience",
      kind: "experience",
      title: "Experience",
      items: [
        {
          ...createSectionItem("experience"),
          id: "sample-experience-northwind",
          company: "Northwind Labs",
          position: "Senior Product Engineer",
          location: "London, UK",
          startDate: "2021-03",
          endDate: "",
          current: true,
          highlights: [
            "Rebuilt the checkout flow, lifting completion 18% across 2M monthly sessions.",
            "Cut median page load from 3.1s to 900ms by moving rendering to the server.",
            "Mentored four engineers; two promoted within the year.",
          ],
          technologies: ["TypeScript", "React", "PostgreSQL"],
        },
        {
          ...createSectionItem("experience"),
          id: "sample-experience-meridian",
          company: "Meridian Health",
          position: "Product Engineer",
          location: "Manchester, UK",
          startDate: "2018-01",
          endDate: "2021-02",
          highlights: [
            "Shipped the patient portal used by 40 clinics and 120k patients.",
            "Introduced accessibility gates in CI, clearing a WCAG AA audit first pass.",
          ],
          technologies: ["Node.js", "GraphQL"],
        },
      ],
    },
    {
      id: "sample-section-projects",
      kind: "projects",
      title: "Projects",
      items: [
        {
          ...createSectionItem("projects"),
          id: "sample-project-atlas",
          name: "Atlas",
          role: "Creator",
          description:
            "<p>Open-source design-token pipeline that keeps Figma and CSS in step. 2.4k stars.</p>",
          startDate: "2022-05",
          technologies: ["TypeScript", "Vite"],
        },
      ],
    },
    {
      id: "sample-section-skills",
      kind: "skills",
      title: "Skills",
      items: [
        {
          ...createSectionItem("skills"),
          id: "sample-skill-typescript",
          name: "TypeScript",
          category: "Engineering",
          level: 5,
        },
        {
          ...createSectionItem("skills"),
          id: "sample-skill-react",
          name: "React",
          category: "Engineering",
          level: 5,
        },
        {
          ...createSectionItem("skills"),
          id: "sample-skill-postgres",
          name: "PostgreSQL",
          category: "Engineering",
          level: 4,
        },
        {
          ...createSectionItem("skills"),
          id: "sample-skill-design-systems",
          name: "Design systems",
          category: "Product",
          level: 4,
        },
        {
          ...createSectionItem("skills"),
          id: "sample-skill-discovery",
          name: "Discovery research",
          category: "Product",
          level: 3,
        },
      ],
    },
    {
      id: "sample-section-education",
      kind: "education",
      title: "Education",
      items: [
        {
          ...createSectionItem("education"),
          id: "sample-education-ucl",
          institution: "University College London",
          degree: "BSc",
          area: "Computer Science",
          location: "London, UK",
          startDate: "2014-09",
          endDate: "2017-06",
          grade: "First class",
        },
      ],
    },
    {
      id: "sample-section-languages",
      kind: "languages",
      title: "Languages",
      items: [
        {
          ...createSectionItem("languages"),
          id: "sample-language-english",
          name: "English",
          proficiency: "native",
        },
        {
          ...createSectionItem("languages"),
          id: "sample-language-twi",
          name: "Twi",
          proficiency: "native",
        },
        {
          ...createSectionItem("languages"),
          id: "sample-language-french",
          name: "French",
          proficiency: "professional",
        },
      ],
    },
    {
      id: "sample-section-certifications",
      kind: "certifications",
      title: "Certifications",
      items: [
        {
          ...createSectionItem("certifications"),
          id: "sample-certification-aws",
          name: "Solutions Architect – Associate",
          issuer: "AWS",
          issueDate: "2023-04",
        },
      ],
    },
  ],
});

export const SAMPLE_RESUME_DOCUMENT: ResumeDocument = sampleDocument;

/**
 * The page setup thumbnails render at.
 *
 * A wider margin than the default: at thumbnail scale the page edge is a few pixels from
 * the card border, and 16mm reads as a document while 14 reads as a crop.
 */
const SAMPLE_PAGE: ResumePage = { ...RESUME_PAGE_DEFAULTS, margin: 16 };

export interface SampleResumeInputOptions {
  /** Which of the template's palettes to preview. Falls back to the first one. */
  paletteId?: string;
}

/**
 * A renderable sample for one template.
 *
 * Returned rather than exported as a constant because the palette varies per call — the
 * gallery previews each card in its template's first palette, and the design panel
 * previews the palette the user is hovering.
 */
export function sampleResumeInput(
  templateId: string,
  { paletteId }: SampleResumeInputOptions = {},
): ResumeRenderInput {
  const theme: ResumeTheme =
    paletteId === undefined ? RESUME_THEME_DEFAULTS : { ...RESUME_THEME_DEFAULTS, paletteId };

  return { document: sampleDocument, theme, page: SAMPLE_PAGE, templateId };
}
