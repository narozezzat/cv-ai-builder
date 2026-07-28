/**
 * Every template the app knows, by id.
 *
 * `resumes.template_id` is a plain text column — no foreign key — so an id that is not
 * here is a normal runtime possibility: a template retired between releases, a row
 * imported from JSON, a hand-edited value. Lookups therefore fall back to the default
 * instead of throwing. A resume must always open; the worst outcome of a stale id is
 * that it opens in the wrong design, which the user can see and change.
 *
 * Phase 4 fills this out to twenty. Adding one is a config file plus a line here.
 */

import { DEFAULT_TEMPLATE_ID } from "@/types/resume";

import type { TemplateDefinition } from "../lib/template-types";
import { modernSlate } from "./modern-slate";

export const TEMPLATES: readonly TemplateDefinition[] = [modernSlate];

const BY_ID = new Map(TEMPLATES.map((template) => [template.id, template]));

export const DEFAULT_TEMPLATE: TemplateDefinition = BY_ID.get(DEFAULT_TEMPLATE_ID) ?? TEMPLATES[0];

export function getTemplateDefinition(templateId: string): TemplateDefinition {
  return BY_ID.get(templateId) ?? DEFAULT_TEMPLATE;
}

export function isKnownTemplateId(templateId: string): boolean {
  return BY_ID.has(templateId);
}
