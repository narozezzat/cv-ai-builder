/**
 * What each AI capability costs, and how hard it may be hammered.
 *
 * These live in `services` rather than in `features/ai` — a deliberate exception to
 * the note in `services/rate-limit.ts` that buckets stay with the feature owning
 * the endpoint. Metering *is* the service here: the credit charge, the ledger row,
 * and the limiter are one transaction-shaped sequence in `run.ts`, and splitting
 * the price list away from the code that charges it is how a capability ends up
 * billed at someone else's rate. `services` also cannot import `features`, so a
 * feature-side registry would be unreachable from the engine that needs it.
 */

import "server-only";

import type { RateLimitRule } from "@/services/rate-limit";
import type { AiModelTier } from "./provider";

/**
 * Every capability the AI suite exposes. The string is written to `ai_usage.
 * capability`, so renaming one orphans its history — add a new id instead.
 */
export const AI_CAPABILITIES = [
  "summary.generate",
  "experience.rewrite",
  "bullets.improve",
  "bullets.fromParagraph",
  "achievements.suggest",
  "skills.suggest",
  "projects.suggest",
  "keywords.generate",
  "jobTitles.suggest",
  "text.grammar",
  "text.atsRewrite",
  "text.tailorToCompany",
  "coverLetter.generate",
  "jobMatch.extract",
  "jobMatch.gaps",
] as const;

export type AiCapability = (typeof AI_CAPABILITIES)[number];

export type AiCapabilityConfig = {
  /** Debited by `charge_ai_credits` before the model runs. */
  credits: number;
  tier: AiModelTier;
  /** Hard ceiling on the answer, so one runaway generation cannot drain a quota. */
  maxOutputTokens: number;
  /**
   * Low for extraction, higher for writing. `jobMatch.extract` sits at 0 because
   * the ATS score is computed from what it returns: a temperature that reshuffles
   * the extracted keyword set makes the score wobble between identical runs, and an
   * unstable score is one nobody can act on.
   */
  temperature: number;
  /**
   * Wall-clock budget in ms. Short for editor-inline actions — a rewrite the user
   * is waiting on is worthless after ten seconds — and long for the one-off
   * documents nobody expects to be instant.
   */
  timeoutMs: number;
};

/**
 * Credit prices are roughly proportional to output length, which is what actually
 * drives provider cost. One credit is the floor for anything the editor fires
 * inline; the long-form generations cost more because they are worth more and
 * because 50 free credits should not buy 50 cover letters.
 */
export const AI_CAPABILITY_CONFIG: Record<AiCapability, AiCapabilityConfig> = {
  "summary.generate": {
    credits: 2,
    tier: "quality",
    maxOutputTokens: 600,
    timeoutMs: 30_000,
    temperature: 0.7,
  },
  "experience.rewrite": {
    credits: 2,
    tier: "quality",
    maxOutputTokens: 900,
    timeoutMs: 30_000,
    temperature: 0.6,
  },
  "bullets.improve": {
    credits: 1,
    tier: "fast",
    maxOutputTokens: 700,
    timeoutMs: 20_000,
    temperature: 0.6,
  },
  "bullets.fromParagraph": {
    credits: 1,
    tier: "fast",
    maxOutputTokens: 700,
    timeoutMs: 20_000,
    temperature: 0.4,
  },
  "achievements.suggest": {
    credits: 1,
    tier: "fast",
    maxOutputTokens: 700,
    timeoutMs: 20_000,
    temperature: 0.8,
  },
  "skills.suggest": {
    credits: 1,
    tier: "fast",
    maxOutputTokens: 500,
    timeoutMs: 20_000,
    temperature: 0.5,
  },
  "projects.suggest": {
    credits: 2,
    tier: "quality",
    maxOutputTokens: 900,
    timeoutMs: 30_000,
    temperature: 0.8,
  },
  "keywords.generate": {
    credits: 1,
    tier: "fast",
    maxOutputTokens: 400,
    timeoutMs: 20_000,
    temperature: 0.3,
  },
  "jobTitles.suggest": {
    credits: 1,
    tier: "fast",
    maxOutputTokens: 300,
    timeoutMs: 20_000,
    temperature: 0.6,
  },
  // Grammar is a correction, not a rewrite: at a high temperature the model starts
  // "improving" sentences the user did not ask it to touch.
  "text.grammar": {
    credits: 1,
    tier: "fast",
    maxOutputTokens: 900,
    timeoutMs: 20_000,
    temperature: 0.1,
  },
  "text.atsRewrite": {
    credits: 2,
    tier: "quality",
    maxOutputTokens: 900,
    timeoutMs: 30_000,
    temperature: 0.4,
  },
  "text.tailorToCompany": {
    credits: 2,
    tier: "quality",
    maxOutputTokens: 900,
    timeoutMs: 30_000,
    temperature: 0.6,
  },
  "coverLetter.generate": {
    credits: 4,
    tier: "quality",
    maxOutputTokens: 1_400,
    timeoutMs: 60_000,
    temperature: 0.7,
  },
  "jobMatch.extract": {
    credits: 2,
    tier: "quality",
    maxOutputTokens: 1_200,
    timeoutMs: 45_000,
    temperature: 0,
  },
  "jobMatch.gaps": {
    credits: 2,
    tier: "quality",
    maxOutputTokens: 900,
    timeoutMs: 30_000,
    temperature: 0.3,
  },
};

/**
 * Two buckets, both charged on every call, both keyed to the user rather than to
 * the capability.
 *
 * Per-capability buckets were the obvious design and the wrong one: fifteen
 * capabilities each with their own allowance is fifteen allowances, so a script
 * cycling through them sails past any single limit. Credits already bound total
 * spend; these bound *rate*, which is what protects the provider quota and the
 * database from a stuck retry loop.
 */
export const AI_RATE_LIMITS = {
  /** Burst control. A human clicking suggest buttons never approaches this. */
  burst: { action: "ai.burst", window: "1 minute", max: 12 },
  /** Sustained control, sized above a heavy editing session and below a script. */
  sustained: { action: "ai.sustained", window: "1 hour", max: 120 },
} satisfies Record<string, RateLimitRule>;

export const AI_RATE_LIMIT_RULES: readonly RateLimitRule[] = [
  AI_RATE_LIMITS.burst,
  AI_RATE_LIMITS.sustained,
];
