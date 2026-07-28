/**
 * The user's writing preferences, turned into prompt text.
 *
 * The canonical definition of these three fields is `aiPreferencesSchema` in
 * `features/profile` — but `services` may not import `features`, and inverting that
 * boundary to share three string unions would be worse than restating them. The
 * shapes are structurally identical, so a profile's `AiPreferences` is assignable
 * to `AiStyle` with no adapter; the `satisfies` in the profile schema and these
 * unions are the two halves that must stay in step.
 */

import "server-only";

export const AI_STYLE_TONES = ["professional", "confident", "friendly", "impactful"] as const;
export const AI_STYLE_VERBOSITY = ["concise", "balanced", "detailed"] as const;
export const AI_STYLE_SPELLING = ["us", "uk"] as const;

export type AiStyle = {
  tone: (typeof AI_STYLE_TONES)[number];
  verbosity: (typeof AI_STYLE_VERBOSITY)[number];
  spelling: (typeof AI_STYLE_SPELLING)[number];
};

export const AI_STYLE_DEFAULTS: AiStyle = {
  tone: "professional",
  verbosity: "balanced",
  spelling: "us",
};

const TONE_GUIDANCE: Record<AiStyle["tone"], string> = {
  professional: "Neutral and businesslike. No hype, no first person, no exclamation marks.",
  confident: "Assertive and ownership-forward: led, drove, owned. Never boastful or unquantified.",
  friendly: "Warm and approachable while staying formal enough for a hiring manager.",
  impactful: "Front-load outcomes and numbers. Every sentence should answer 'so what?'.",
};

const VERBOSITY_GUIDANCE: Record<AiStyle["verbosity"], string> = {
  concise: "Be tight. Bullets stay under 15 words; prose stays under 40.",
  balanced: "Bullets run 15-25 words; prose runs 40-70. Enough detail to be concrete.",
  detailed: "Bullets run 25-35 words; prose runs 70-110. Include context, action, and result.",
};

const SPELLING_GUIDANCE: Record<AiStyle["spelling"], string> = {
  us: "Use American spelling: organize, optimize, color, center.",
  uk: "Use British spelling: organise, optimise, colour, centre.",
};

/**
 * The rules every capability shares, so no individual prompt has to remember them.
 *
 * The last three are anti-fabrication rules, and they are the load-bearing ones: a
 * resume the model embellished is a resume that fails a reference check, which is a
 * worse outcome for the user than a weak bullet.
 */
const HOUSE_RULES = [
  "You are an expert resume writer and career coach.",
  "Write in the resume register: no preamble, no meta-commentary, no markdown syntax.",
  "Never invent employers, dates, titles, technologies, or metrics that are not in the input.",
  "If a number would strengthen a claim but none was supplied, phrase it without one rather than guessing.",
  "Keep the candidate's own factual claims intact; you are editing wording, not history.",
] as const;

/**
 * Builds the `instructions` argument for a model call.
 *
 * SECURITY: everything this returns is server-authored. User text goes in the
 * prompt, never here — a system instruction assembled from user input is a prompt
 * injection with the model's full trust behind it.
 */
export function buildInstructions(style: AiStyle, capabilityRules: readonly string[]): string {
  return [
    ...HOUSE_RULES,
    ...capabilityRules,
    `Tone: ${TONE_GUIDANCE[style.tone]}`,
    `Length: ${VERBOSITY_GUIDANCE[style.verbosity]}`,
    `Spelling: ${SPELLING_GUIDANCE[style.spelling]}`,
  ].join("\n");
}
