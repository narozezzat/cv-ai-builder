/**
 * Terms of Service and Privacy Policy copy.
 *
 * Data rather than JSX so both documents share one renderer, and so the structure
 * (heading → paragraphs → bullets) stays uniform. Nothing here is interpolated
 * from user input, so the renderer can treat it as plain text.
 *
 * The statements below describe what the application actually does — Supabase for
 * auth and storage, an LLM provider for the AI features, signed URLs for exports,
 * opt-in public sharing. Keep them in step with the code: a policy that overstates
 * or understates the real data flow is a liability, not boilerplate.
 *
 * NOTE FOR MAINTAINERS: have counsel review both documents before commercial
 * launch, and bump `updated` whenever the substance changes.
 */

import { siteConfig } from "@/lib/site";

export type LegalSection = {
  heading: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
};

export type LegalDocument = {
  /** Page heading and `<title>`. */
  title: string;
  /** Meta description. */
  description: string;
  /** ISO date, rendered with `<time>` so it is machine-readable. */
  updated: string;
  /** One-paragraph plain-language summary above the formal text. */
  summary: string;
  sections: readonly LegalSection[];
};

const CONTACT_EMAIL = "support@reforge.app";
const PRIVACY_EMAIL = "privacy@reforge.app";
const UPDATED = "2026-07-26";

export const TERMS: LegalDocument = {
  title: "Terms of Service",
  description: `The agreement between you and ${siteConfig.name} covering accounts, acceptable use, AI output, and cancellation.`,
  updated: UPDATED,
  summary: `Plain version: your resumes are yours, we host them and help you write them, and you are responsible for what you claim in them. Don't abuse the AI features or try to break the service, and you can leave with your data whenever you like.`,
  sections: [
    {
      heading: "1. Who these terms are between",
      paragraphs: [
        `These terms govern your use of ${siteConfig.name} (the "Service"), available at ${siteConfig.url}. By creating an account or using the Service you agree to them. If you do not agree, do not use the Service.`,
        `We may update these terms. Material changes will be announced by email or in-product notice before they take effect, and the "last updated" date above always reflects the current version. Continuing to use the Service after a change takes effect means you accept the revised terms.`,
      ],
    },
    {
      heading: "2. Your account",
      paragraphs: [
        `You need an account to build a resume. You must provide an email address you control, keep your credentials confidential, and be at least 16 years old — or the minimum age of digital consent where you live, whichever is higher.`,
        `You are responsible for activity under your account. Tell us at ${CONTACT_EMAIL} as soon as you suspect unauthorised access, and we will help you secure it.`,
      ],
    },
    {
      heading: "3. Your content stays yours",
      paragraphs: [
        `You keep all rights to the text, images, and documents you put into the Service ("Your Content"). We claim no ownership of it.`,
        `You grant us a limited, worldwide, royalty-free licence to store, reproduce, transmit, and display Your Content strictly to operate the Service for you: rendering previews, generating exports, running the AI features you invoke, and keeping the version history you asked for. That licence ends when you delete the content or your account, apart from backups that expire on their normal schedule.`,
        `If you publish a resume to a public link, you are choosing to make that content readable by anyone who has the link. You can revoke the link at any time.`,
      ],
    },
    {
      heading: "4. AI features and their limits",
      paragraphs: [
        `The Service uses large language models to draft, rewrite, and score text. Model output is generated from statistical patterns, not verified facts. It can be inaccurate, generic, or subtly wrong about your own history.`,
        `You are solely responsible for the accuracy of your finished resume. Review everything the AI writes before you send it to an employer. Do not rely on the ATS score, match percentage, or keyword suggestions as a guarantee of any hiring outcome — they are heuristics, and no employer's screening system is public.`,
      ],
      bullets: [
        `We do not guarantee interviews, offers, or that any resume will pass a particular applicant tracking system.`,
        `AI suggestions are proposals. Nothing is written into your resume until you accept it.`,
        `Misrepresenting your qualifications is your responsibility, not ours, whoever drafted the sentence.`,
      ],
    },
    {
      heading: "5. Acceptable use",
      paragraphs: [`You agree not to:`],
      bullets: [
        `Use the Service to create content that is unlawful, defamatory, or fraudulent, including fabricated credentials, employment, or identities.`,
        `Attempt to access another user's data, or probe, scan, or test the security of the Service except under a written agreement with us.`,
        `Circumvent usage limits, credit allowances, or rate limits, or automate access in a way that degrades the Service for others.`,
        `Resell, sublicense, or use the Service to build a competing product, including scraping our templates or using our AI endpoints as an unlicensed model proxy.`,
        `Upload malware, or content you do not have the right to upload.`,
      ],
    },
    {
      heading: "6. Plans, credits, and payment",
      paragraphs: [
        `The Service has a free tier with a monthly allowance of AI credits, and paid plans with a larger allowance and additional features. Prices and allowances are shown at the point of purchase.`,
        `Paid plans renew automatically for the same period until cancelled. You can cancel at any time from your settings; cancellation stops the next renewal and your plan stays active until the end of the period you have already paid for. We do not pro-rate partial periods except where the law requires it.`,
        `AI credits are a usage allowance, not currency. They reset each billing period, do not roll over, and have no cash value.`,
      ],
    },
    {
      heading: "7. Availability and changes",
      paragraphs: [
        `We work to keep the Service available but do not promise uninterrupted operation. We may change, suspend, or discontinue features, and we will give reasonable notice before removing something you depend on.`,
        `You can export your data as JSON or PDF at any time, and we will keep that export available for as long as your account exists. That is the practical protection behind this section: nothing you build here is locked in.`,
      ],
    },
    {
      heading: "8. Suspension and termination",
      paragraphs: [
        `You may delete your account at any time from your settings. Deletion removes your resumes, exports, and profile; backups age out within 30 days.`,
        `We may suspend or terminate an account that breaches these terms, that we are legally required to act on, or that is being used in a way that threatens the security of the Service or other users. Except where a delay would cause harm, we will tell you why and give you a chance to respond and to export your data.`,
      ],
    },
    {
      heading: "9. Disclaimers and liability",
      paragraphs: [
        `The Service is provided "as is" and "as available", without warranties of any kind beyond those that cannot be excluded by law. We do not warrant that the Service will meet your requirements or that AI output will be accurate.`,
        `To the fullest extent permitted by law, our total liability arising out of or relating to the Service is limited to the greater of the amount you paid us in the twelve months before the claim, or fifty US dollars. We are not liable for lost profits, lost opportunities, or indirect or consequential damages.`,
        `Nothing in these terms limits liability for fraud, death or personal injury caused by negligence, or anything else that cannot lawfully be limited. Some jurisdictions do not allow certain exclusions, in which case the exclusions above apply only to the extent permitted.`,
      ],
    },
    {
      heading: "10. Governing law and contact",
      paragraphs: [
        `These terms are governed by the laws of the jurisdiction in which ${siteConfig.name} is established, without regard to conflict-of-laws rules, and without depriving you of the protections of mandatory consumer law where you live.`,
        `Questions about these terms: ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  title: "Privacy Policy",
  description: `What ${siteConfig.name} collects, why, who processes it, and how to get it deleted.`,
  updated: UPDATED,
  summary: `Plain version: we collect what we need to run the product — your account, your resumes, and basic usage counters. Resume text you send to an AI feature goes to our model provider to be processed and is not used to train their models. We don't sell anything, and you can export or delete everything.`,
  sections: [
    {
      heading: "1. What we collect",
      paragraphs: [`We collect three kinds of data, and nothing else:`],
      bullets: [
        `Account data — your email address, display name, avatar if you upload one, and, if you sign in with Google or GitHub, the identifier and basic profile that provider returns. We never receive your password from a social provider.`,
        `Content you create — resume documents, cover letters, job descriptions you paste in, tags, folders, and version history. This is the substance of the product and it is stored because you asked us to keep it.`,
        `Operational data — timestamps, AI credit usage, export counts, view counts on public links, coarse activity logs for your own audit trail, and a hashed identifier used for rate limiting. Rate-limit identifiers are one-way hashes of your email or IP: we can compare them for equality but cannot read them back.`,
      ],
    },
    {
      heading: "2. What we do not collect",
      bullets: [
        `We do not use third-party advertising or cross-site tracking cookies. The only cookies we set are the ones that keep you signed in and remember your theme.`,
        `We do not store payment card details. Payments, when you make them, are handled by our payment processor and we see only the plan and its status.`,
        `We do not ask for, or want, government identifiers, health data, or any other special-category data. Please do not put it in your resume.`,
      ],
    },
    {
      heading: "3. Why we process it",
      paragraphs: [
        `To provide the Service you signed up for — storing and rendering your resumes, generating exports, and running the AI features you invoke. This is performance of our contract with you.`,
        `To keep the Service secure and available — rate limiting, abuse prevention, and debugging. This is our legitimate interest, and it is the narrowest processing we can do and still keep accounts from being brute-forced.`,
        `To meet legal obligations, such as retaining billing records.`,
        `We do not use your resume content to train our own models, and we do not sell or rent personal data to anyone, for any purpose.`,
      ],
    },
    {
      heading: "4. Who else processes your data",
      paragraphs: [
        `We use a small number of processors, each under a data-processing agreement, each limited to what it needs:`,
      ],
      bullets: [
        `Supabase — authentication, PostgreSQL database, and file storage. Your resumes and avatars live here, protected by row-level security so a query can only ever return rows belonging to the authenticated account.`,
        `Our AI provider (OpenAI by default) — receives only the text needed for the specific feature you invoked, at the moment you invoke it. Under their API terms this input is not used to train their models. If you never use an AI feature, your resume text is never sent to them.`,
        `Vercel — application hosting and edge delivery, which necessarily processes request metadata such as IP addresses.`,
        `Our payment processor — subscription billing, if you buy a paid plan.`,
      ],
    },
    {
      heading: "5. Public links and exports",
      paragraphs: [
        `A resume is private by default. Publishing one to a public link is an explicit action, and it makes that resume readable by anyone holding the link — treat the link as the credential it is. Public resumes are marked "no index" unless you opt in to search engine indexing, and revoking the link takes effect immediately.`,
        `Generated PDFs and images are stored in a private bucket and served through short-lived signed URLs, so an export URL cannot be shared or replayed indefinitely.`,
      ],
    },
    {
      heading: "6. How long we keep it",
      paragraphs: [
        `Resumes you delete go to a trash bin and are recoverable for 30 days, then permanently removed. Exports are cleaned up on a rolling schedule. Activity logs are kept for 12 months so your audit trail is useful. Billing records are kept as long as tax law requires.`,
        `Deleting your account removes your profile, resumes, exports, and public links. Encrypted backups age out within 30 days of deletion.`,
      ],
    },
    {
      heading: "7. Your rights",
      paragraphs: [
        `Wherever you live, you can do all of the following from your settings, without asking us: see your data, correct it, export it as JSON, and delete it. We built those controls into the product rather than behind a request form because a right you have to email someone about is a right with friction.`,
        `Depending on where you live you may also have the right to restrict or object to certain processing, to lodge a complaint with your local data protection authority, and — under laws such as the GDPR, UK GDPR, and CCPA/CPRA — to know whether we sell or share personal information. We do not, and we do not discriminate against anyone for exercising a privacy right.`,
        `For anything the in-product controls do not cover, email ${PRIVACY_EMAIL} and we will respond within 30 days.`,
      ],
    },
    {
      heading: "8. Security",
      paragraphs: [
        `Data is encrypted in transit and at rest. Authorisation is enforced in the database itself through row-level security, not only in application code, so a bug in a query cannot return another account's rows. Administrative credentials are held server-side only and never reach the browser. Sign-in attempts and password resets are rate limited per account and per network.`,
        `No system is perfect. If we discover a breach affecting your personal data, we will notify affected users and the relevant authority without undue delay, and we will tell you what happened rather than what we would prefer had happened.`,
      ],
    },
    {
      heading: "9. International transfers and children",
      paragraphs: [
        `Our processors operate globally, so your data may be processed outside your country. Where that involves a transfer out of the EEA or UK, it is covered by Standard Contractual Clauses or an equivalent lawful mechanism.`,
        `The Service is not directed at children under 16. If you believe a child has created an account, contact ${PRIVACY_EMAIL} and we will delete it.`,
      ],
    },
    {
      heading: "10. Changes and contact",
      paragraphs: [
        `We will announce material changes to this policy by email or in-product notice before they take effect. The date above always reflects the current version.`,
        `Privacy questions, requests, or complaints: ${PRIVACY_EMAIL}.`,
      ],
    },
  ],
};
