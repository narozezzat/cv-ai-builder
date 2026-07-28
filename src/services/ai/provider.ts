/**
 * Which model answers, and under whose key.
 *
 * Provider choice is an environment concern, not a per-call one: every capability
 * asks for a *tier* (`fast` or `quality`) and this module resolves it against
 * `AI_PROVIDER`. That keeps the swap to a single env var — the reason the project
 * defaults to Google, whose free tier is the only one that lets development and
 * never-upgrading users work without a bill.
 *
 * SECURITY: keys are read here and nowhere else. Model instances are created per
 * call rather than cached at module scope, because a cached instance closes over
 * the key and would survive a rotation until the process restarted.
 */

import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

import { isAiConfigured, requireServerEnv, serverEnv } from "@/lib/env/server";
import { AiError } from "./errors";

/**
 * `fast` for the short, high-volume rewrites the editor fires constantly;
 * `quality` for the long-form, one-off generations (cover letter, full ATS pass)
 * where a better answer is worth the latency and cost.
 */
export type AiModelTier = "fast" | "quality";

export type AiProviderName = (typeof serverEnv)["AI_PROVIDER"];

type TierModels = Record<AiModelTier, string>;

/**
 * Defaults are stable GA aliases, never `-preview` or `-exp` ones: a preview alias
 * can be retired without notice, which would turn every AI action into a 404 that
 * no deploy of ours caused.
 */
const MODEL_DEFAULTS: Record<AiProviderName, TierModels> = {
  google: { fast: "gemini-2.5-flash", quality: "gemini-2.5-pro" },
  openai: { fast: "gpt-4.1-mini", quality: "gpt-4.1" },
  anthropic: { fast: "claude-haiku-4-5-20251001", quality: "claude-sonnet-4-5-20250929" },
};

/** Env overrides so a model can be changed without a deploy of new code. */
function modelId(provider: AiProviderName, tier: AiModelTier): string {
  const override = tier === "fast" ? serverEnv.AI_MODEL_FAST : serverEnv.AI_MODEL_QUALITY;

  return override ?? MODEL_DEFAULTS[provider][tier];
}

export type ResolvedModel = {
  model: LanguageModel;
  /** Recorded in `ai_usage` so an invoice can be reconciled per provider. */
  provider: AiProviderName;
  modelId: string;
};

/**
 * Throws `AiError("not_configured")` rather than letting an undefined key reach the
 * SDK, where a missing key surfaces as a 401 from a third party half a second into
 * the request — after the user's credits have already been charged.
 */
export function resolveModel(tier: AiModelTier): ResolvedModel {
  if (!isAiConfigured()) {
    throw new AiError("not_configured");
  }

  const provider = serverEnv.AI_PROVIDER;
  const id = modelId(provider, tier);

  switch (provider) {
    case "openai": {
      const openai = createOpenAI({ apiKey: requireServerEnv("OPENAI_API_KEY") });

      return { model: openai(id), provider, modelId: id };
    }

    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: requireServerEnv("ANTHROPIC_API_KEY") });

      return { model: anthropic(id), provider, modelId: id };
    }

    default: {
      const google = createGoogle({ apiKey: requireServerEnv("GOOGLE_GENERATIVE_AI_API_KEY") });

      return { model: google(id), provider, modelId: id };
    }
  }
}

/**
 * Provider and model without instantiating anything.
 *
 * The ledger has to be written for calls that failed *before* a model existed —
 * "out of credits", "not configured" — so metering cannot depend on
 * `resolveModel` having succeeded.
 */
export function describeModel(tier: AiModelTier): { provider: AiProviderName; modelId: string } {
  const provider = serverEnv.AI_PROVIDER;

  return { provider, modelId: modelId(provider, tier) };
}
