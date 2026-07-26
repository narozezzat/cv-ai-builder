/**
 * Shapes for everything a user may change about their own account row.
 *
 * The list is deliberately closed. `profiles` also holds `role` and `ai_credits`,
 * and RLS grants access per row rather than per column — so the guarantee that a
 * user cannot promote themselves comes from the database trigger
 * (`protect_profile_privileges`) *and* from these schemas never carrying those
 * fields in the first place. Two independent layers, because the trigger is the
 * one that must hold and this one is the one that documents intent.
 *
 * Isomorphic: the forms validate with these, and every server action re-parses
 * with the same schema.
 */

import { z } from "zod";

// ── Identity ──────────────────────────────────────────────────────────────────

/** Mirrors `check (char_length(full_name) <= 120)` in the core migration. */
export const PROFILE_NAME_MAX = 120;
/** Mirrors `check (char_length(headline) <= 200)`. */
export const PROFILE_HEADLINE_MAX = 200;

/**
 * Optional free text. Empty stays empty rather than becoming `undefined`, so a
 * controlled input can round-trip it; the action converts `""` to SQL `null`.
 */
const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer.`);

export const profileInfoSchema = z.object({
  fullName: optionalText(PROFILE_NAME_MAX, "Your name"),
  headline: optionalText(PROFILE_HEADLINE_MAX, "Your headline"),
});

export type ProfileInfoInput = z.infer<typeof profileInfoSchema>;

// ── Appearance ────────────────────────────────────────────────────────────────

/**
 * `system` is a real stored value, not the absence of one: "follow the OS" is a
 * choice the user made and it has to survive a new device.
 */
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** `ar` is present from the start because it forces RTL to be designed for, not retrofitted. */
export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

export const appearanceSchema = z.object({
  theme: z.enum(THEME_PREFERENCES),
  locale: z.enum(LOCALES),
});

export type AppearanceInput = z.infer<typeof appearanceSchema>;

/**
 * Narrows the two appearance columns, which Postgres holds as plain `text` behind a
 * check constraint and PostgREST therefore types as `string`.
 *
 * Falling back rather than throwing is the same call made in `parseAiPreferences`:
 * a row written by an older build, or a constraint relaxed in a future migration,
 * must not be able to take down the page that would let the user fix it.
 */
export function parseAppearance(theme: unknown, locale: unknown): AppearanceInput {
  const parsed = appearanceSchema.safeParse({ theme, locale });

  return parsed.success ? parsed.data : { theme: "system", locale: "en" };
}

// ── AI preferences ────────────────────────────────────────────────────────────

export const AI_TONES = ["professional", "confident", "friendly", "impactful"] as const;
export const AI_VERBOSITY = ["concise", "balanced", "detailed"] as const;
export const AI_SPELLING = ["us", "uk"] as const;

export type AiTone = (typeof AI_TONES)[number];
export type AiVerbosity = (typeof AI_VERBOSITY)[number];
export type AiSpelling = (typeof AI_SPELLING)[number];

export const AI_TONE_LABELS: Record<AiTone, string> = {
  professional: "Professional",
  confident: "Confident",
  friendly: "Friendly",
  impactful: "Impactful",
};

export const AI_VERBOSITY_LABELS: Record<AiVerbosity, string> = {
  concise: "Concise",
  balanced: "Balanced",
  detailed: "Detailed",
};

export const AI_SPELLING_LABELS: Record<AiSpelling, string> = {
  us: "American (organize, color)",
  uk: "British (organise, colour)",
};

/**
 * Stored in `profiles.ai_preferences jsonb`, which defaults to `'{}'` — so every
 * field carries a default and the schema parses an empty object successfully.
 * That is what lets the column change shape as the AI surface grows without a
 * migration or a backfill.
 */
export const aiPreferencesSchema = z.object({
  tone: z.enum(AI_TONES).default("professional"),
  verbosity: z.enum(AI_VERBOSITY).default("balanced"),
  spelling: z.enum(AI_SPELLING).default("us"),
});

export type AiPreferences = z.infer<typeof aiPreferencesSchema>;

/**
 * The same three fields, without the defaults.
 *
 * `aiPreferencesSchema` has to accept `'{}'`, which makes every field optional on
 * its *input* side — and `zodResolver` types a form by a schema's input, so a form
 * built on it would treat all three as possibly-undefined even though the UI always
 * holds a value for each. This is the resolver-facing twin; the `satisfies` is what
 * stops the two drifting apart.
 */
export const aiPreferencesFormSchema = z.object({
  tone: z.enum(AI_TONES),
  verbosity: z.enum(AI_VERBOSITY),
  spelling: z.enum(AI_SPELLING),
}) satisfies z.ZodType<AiPreferences>;

export const AI_PREFERENCES_DEFAULTS: AiPreferences = aiPreferencesSchema.parse({});

/**
 * Reads the jsonb column into a complete object.
 *
 * Never throws: the column is untyped as far as Postgres is concerned, and a row
 * written by an older build must not be able to break the settings page. Unknown
 * or malformed values fall back to defaults, and the next save rewrites them.
 */
export function parseAiPreferences(value: unknown): AiPreferences {
  const parsed = aiPreferencesSchema.safeParse(value ?? {});

  return parsed.success ? parsed.data : AI_PREFERENCES_DEFAULTS;
}
