import {
  ArrowLeftRight,
  BarChart3,
  FileDown,
  LayoutTemplate,
  Link2,
  MonitorSmartphone,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";

/**
 * Marketing copy as data.
 *
 * Kept out of the components so the sections stay layout-only: adding a feature
 * card or an FAQ entry is a data edit, and the same source feeds the FAQ
 * structured data without the answers being written twice.
 */

export interface FeatureItem {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Spans two columns on the 3-up grid. Reserved for the headline capability. */
  wide?: boolean;
}

export const FEATURES: readonly FeatureItem[] = [
  {
    icon: Sparkles,
    title: "AI that writes like a hiring manager",
    description:
      "Turn a job title into a summary, a duty into an achievement, and a paragraph into tight bullets. Every suggestion arrives as a diff you accept or reject — nothing is rewritten behind your back.",
    wide: true,
  },
  {
    icon: Target,
    title: "ATS score you can act on",
    description:
      "Paste a job description and get a match percentage with the exact keywords you are missing, ranked by how much each one moves the score.",
  },
  {
    icon: LayoutTemplate,
    title: "20 recruiter-tested templates",
    description:
      "Modern, minimal, executive, technical, creative. Switch template or palette at any time — your content never re-flows into nonsense.",
  },
  {
    icon: MonitorSmartphone,
    title: "Live preview, zero lag",
    description:
      "The page you see is the page that prints. Type on the left, watch A4 or Letter update on the right at 60fps.",
  },
  {
    icon: FileDown,
    title: "Real PDF export",
    description:
      "Selectable text, embedded fonts, honest page breaks, 300 DPI PNG and JPEG. Rendered by the same engine as the preview, so they cannot diverge.",
  },
  {
    icon: BarChart3,
    title: "Know what happens next",
    description:
      "Version history on every save, download counts, and view analytics on any resume you share.",
  },
  {
    icon: Link2,
    title: "Share a link, not an attachment",
    description:
      "Publish a resume to its own URL with a QR code for print. Unlisted by default — you decide when search engines see it.",
  },
  {
    icon: ArrowLeftRight,
    title: "Bring your existing resume",
    description:
      "Import a PDF, DOCX, or JSON export and review the parsed result field by field before anything is saved.",
  },
] as const;

export interface StepItem {
  title: string;
  description: string;
}

export const STEPS: readonly StepItem[] = [
  {
    title: "Start from your history",
    description:
      "Import an existing resume or start from a blank one. Add roles, education, and projects in a form that never loses your place.",
  },
  {
    title: "Let the AI sharpen it",
    description:
      "Generate a summary, rewrite weak bullets into measurable achievements, and fill the skill gaps a recruiter would notice.",
  },
  {
    title: "Target the job, then export",
    description:
      "Paste the description, close the keyword gaps the score surfaces, pick a template, and download a print-ready PDF.",
  },
] as const;

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQS: readonly FaqItem[] = [
  {
    question: "Will an applicant tracking system be able to read my resume?",
    answer:
      "Yes. Every template exports as real text in a single logical reading order — no text baked into images, no multi-column tricks that scramble parsing. The ATS score checks your content against a job description on top of that.",
  },
  {
    question: "Is the AI writing my resume for me?",
    answer:
      "It drafts, you decide. Each suggestion is shown next to your current text and only enters the document when you accept it, so the finished resume is in your voice and reflects work you actually did.",
  },
  {
    question: "Can I move between templates after I have written everything?",
    answer:
      "At any point. Content and presentation are stored separately, so switching template or colour palette re-renders the same document rather than asking you to re-enter it.",
  },
  {
    question: "What happens to my data?",
    answer:
      "Your resumes are yours. Row-level security means no other account can read them, sharing is off until you switch it on, and deleting a resume moves it to a trash bin you can empty for good.",
  },
  {
    question: "Do I need to pay to export a PDF?",
    answer:
      "No. Building, editing, and exporting a resume are free. AI generation runs on credits, and every account starts with enough to write a full resume.",
  },
] as const;

/**
 * Landing-page template teasers.
 *
 * `layout` names one of the layout primitives the template engine is built on,
 * so the thumbnails here depict real shapes the product ships rather than
 * decorative rectangles. The full gallery — every template, every palette —
 * lives behind the dashboard.
 */
export type TemplateLayoutPreview =
  | "single-column"
  | "sidebar-left"
  | "sidebar-right"
  | "header-banner"
  | "timeline-split"
  | "two-column";

export interface TemplatePreview {
  name: string;
  /** One-word family, shown as a caption. */
  family: string;
  layout: TemplateLayoutPreview;
  /** Accent colour, as an oklch string so it matches the token palette. */
  accent: string;
}

export const TEMPLATE_PREVIEWS: readonly TemplatePreview[] = [
  { name: "Meridian", family: "Modern", layout: "sidebar-left", accent: "oklch(0.52 0.22 280)" },
  { name: "Quartz", family: "Minimal", layout: "single-column", accent: "oklch(0.45 0.03 260)" },
  {
    name: "Sterling",
    family: "Executive",
    layout: "header-banner",
    accent: "oklch(0.42 0.11 245)",
  },
  { name: "Circuit", family: "Technical", layout: "two-column", accent: "oklch(0.55 0.15 195)" },
  { name: "Atelier", family: "Creative", layout: "sidebar-right", accent: "oklch(0.58 0.19 25)" },
  {
    name: "Cadence",
    family: "Professional",
    layout: "timeline-split",
    accent: "oklch(0.5 0.13 155)",
  },
] as const;

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Templates", href: "#templates" },
  { label: "FAQ", href: "#faq" },
] as const;

/**
 * Trust row under the hero. Deliberately capability claims rather than invented
 * customer counts or logos — a fabricated "trusted by 40,000 users" is a lie the
 * product cannot back up on day one.
 */
export const HERO_PROOF = [
  "ATS-safe exports",
  "20 templates",
  "No watermarks",
  "Your data stays yours",
] as const;
