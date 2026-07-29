/**
 * Every template the app knows, by id.
 *
 * `resumes.template_id` is a plain text column — no foreign key — so an id that is not
 * here is a normal runtime possibility: a template retired between releases, a row
 * imported from JSON, a hand-edited value. Lookups therefore fall back to the default
 * instead of throwing. A resume must always open; the worst outcome of a stale id is
 * that it opens in the wrong design, which the user can see and change.
 *
 * Order here is the gallery order: two per category, categories grouped. Adding a template
 * is a config file plus a line in this array — `registry.test.ts` asserts the invariants
 * (unique ids, four-plus palettes, a real layout, both slots per category filled).
 */

import { DEFAULT_TEMPLATE_ID } from "@/types/resume";

import type { TemplateDefinition } from "../lib/template-types";
import { corporateColumn } from "./corporate-column";
import { corporateNavy } from "./corporate-navy";
import { creativeArc } from "./creative-arc";
import { creativeCanvas } from "./creative-canvas";
import { designerPortfolio } from "./designer-portfolio";
import { designerStudio } from "./designer-studio";
import { elegantLine } from "./elegant-line";
import { elegantSerif } from "./elegant-serif";
import { executiveCrest } from "./executive-crest";
import { executiveMono } from "./executive-mono";
import { minimalQuiet } from "./minimal-quiet";
import { minimalThin } from "./minimal-thin";
import { modernAurora } from "./modern-aurora";
import { modernSlate } from "./modern-slate";
import { professionalBrief } from "./professional-brief";
import { professionalLedger } from "./professional-ledger";
import { startupPitch } from "./startup-pitch";
import { startupSprint } from "./startup-sprint";
import { techGrid } from "./tech-grid";
import { techTerminal } from "./tech-terminal";

export const TEMPLATES: readonly TemplateDefinition[] = [
  modernSlate,
  modernAurora,
  minimalThin,
  minimalQuiet,
  professionalLedger,
  professionalBrief,
  creativeCanvas,
  creativeArc,
  executiveMono,
  executiveCrest,
  techTerminal,
  techGrid,
  designerStudio,
  designerPortfolio,
  corporateNavy,
  corporateColumn,
  elegantSerif,
  elegantLine,
  startupPitch,
  startupSprint,
];

const BY_ID = new Map(TEMPLATES.map((template) => [template.id, template]));

export const DEFAULT_TEMPLATE: TemplateDefinition = BY_ID.get(DEFAULT_TEMPLATE_ID) ?? TEMPLATES[0];

export function getTemplateDefinition(templateId: string): TemplateDefinition {
  return BY_ID.get(templateId) ?? DEFAULT_TEMPLATE;
}

export function isKnownTemplateId(templateId: string): boolean {
  return BY_ID.has(templateId);
}
