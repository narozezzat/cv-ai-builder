import { describe, expect, it } from "vitest";

import {
  capabilityLabel,
  failureLabel,
  startOfMonthIso,
  summarizeAiUsage,
} from "@/features/profile/lib/ai-usage";
import type { AiUsageEntry } from "@/types/db";

/** Only the fields the rollup reads have to be meaningful; the rest are filler. */
function entry(overrides: Partial<AiUsageEntry> = {}): AiUsageEntry {
  return {
    id: 1,
    capability: "summary.generate",
    provider: "google",
    model: "gemini-2.5-flash",
    credits_charged: 1,
    prompt_tokens: 100,
    completion_tokens: 40,
    total_tokens: 140,
    cost_usd: 0.0002,
    latency_ms: 900,
    success: true,
    error_code: null,
    created_at: "2026-07-14T10:00:00.000Z",
    ...overrides,
  };
}

describe("capabilityLabel", () => {
  it("uses the written label for a known capability", () => {
    expect(capabilityLabel("jobMatch.extract")).toBe("Job posting scored");
  });

  /**
   * The degradation path matters more than the happy one: `capability` is free text,
   * so a capability that ships before this map is updated must still name itself
   * rather than render an empty ledger row.
   */
  it("humanizes an unknown capability instead of blanking it", () => {
    expect(capabilityLabel("resume.polish")).toBe("Resume polish");
    expect(capabilityLabel("cover_letter.reworkTone")).toBe("Cover letter rework tone");
  });

  it("never returns an empty string", () => {
    expect(capabilityLabel("")).toBe("");
    expect(capabilityLabel("x")).toBe("X");
  });
});

describe("failureLabel", () => {
  it("names a known failure", () => {
    expect(failureLabel("provider_unavailable")).toBe("Provider unavailable");
  });

  it("falls back to a plain 'Failed' for an unknown code", () => {
    expect(failureLabel("some_new_code")).toBe("Failed");
  });

  /** A failed row with no code is possible — the runner records what it was given. */
  it("handles a missing code", () => {
    expect(failureLabel(null)).toBe("Failed");
  });
});

describe("startOfMonthIso", () => {
  it("returns the first instant of the month in UTC", () => {
    expect(startOfMonthIso(new Date("2026-07-29T23:45:00.000Z"))).toBe("2026-07-01T00:00:00.000Z");
  });

  /**
   * The boundary is UTC, not local: an account in UTC+14 on the 1st must still see
   * its own month, and the credit reset it mirrors runs on UTC.
   */
  it("does not shift with a local-time date late in the previous month", () => {
    // 23:30 on Jun 30 UTC — a UTC+2 viewer already calls this July.
    expect(startOfMonthIso(new Date("2026-06-30T23:30:00.000Z"))).toBe("2026-06-01T00:00:00.000Z");
  });

  it("handles the January boundary", () => {
    expect(startOfMonthIso(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("summarizeAiUsage", () => {
  it("returns zeros for an empty month", () => {
    expect(summarizeAiUsage([])).toEqual({
      creditsSpent: 0,
      calls: 0,
      failures: 0,
      tokens: 0,
      costUsd: 0,
    });
  });

  /**
   * The load-bearing assertion: a failed call is charged, so its credits belong in
   * the total. Dropping them would make the ledger disagree with the balance, which
   * is the one thing the ledger exists to explain.
   */
  it("counts credits from failed calls", () => {
    const summary = summarizeAiUsage([
      entry({ id: 1, credits_charged: 2 }),
      entry({
        id: 2,
        credits_charged: 1,
        success: false,
        error_code: "provider_unavailable",
        // A failed call reports no usage, so the runner records zeros and a null total.
        total_tokens: null,
        prompt_tokens: 0,
        completion_tokens: 0,
        cost_usd: 0,
      }),
    ]);

    expect(summary.creditsSpent).toBe(3);
    expect(summary.calls).toBe(2);
    expect(summary.failures).toBe(1);
  });

  it("treats a null token count as zero rather than NaN", () => {
    const summary = summarizeAiUsage([
      entry({ id: 1, total_tokens: 140 }),
      entry({ id: 2, total_tokens: null }),
    ]);

    expect(summary.tokens).toBe(140);
    expect(Number.isNaN(summary.tokens)).toBe(false);
  });

  it("sums cost across rows", () => {
    const summary = summarizeAiUsage([
      entry({ id: 1, cost_usd: 0.0002 }),
      entry({ id: 2, cost_usd: 0.0003 }),
    ]);

    expect(summary.costUsd).toBeCloseTo(0.0005, 10);
  });
});
