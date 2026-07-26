import { describe, expect, it } from "vitest";
import { z } from "zod";

import { withoutBlanks } from "./blank";

describe("withoutBlanks", () => {
  it("drops empty and whitespace-only strings", () => {
    expect(withoutBlanks({ a: "", b: "   ", c: "\n\t" })).toEqual({});
  });

  it("keeps every other value byte-for-byte", () => {
    const source = { a: "sk-abc", b: " padded ", c: "0", d: undefined };

    expect(withoutBlanks(source)).toEqual({ a: "sk-abc", b: " padded ", c: "0", d: undefined });
  });

  it("leaves non-string values alone", () => {
    expect(withoutBlanks({ a: 0, b: false, c: null })).toEqual({ a: 0, b: false, c: null });
  });

  /**
   * The regression this exists for: `.env.example` documents optional keys as a
   * bare `KEY=`, which loads as the empty string. Without normalization an
   * `.optional()` field rejects it and the env module throws at import — during
   * `next build`'s page-data collection, so a faithful copy of the template
   * fails the build rather than the feature.
   */
  it("lets a documented blank satisfy an optional schema", () => {
    const schema = z.object({ OPENAI_API_KEY: z.string().startsWith("sk-").optional() });
    const loaded = { OPENAI_API_KEY: "" };

    expect(schema.safeParse(loaded).success).toBe(false);
    expect(schema.safeParse(withoutBlanks(loaded))).toEqual({
      success: true,
      data: {},
    });
  });

  it("still rejects a blank where the schema requires a value", () => {
    const schema = z.object({ NEXT_PUBLIC_SUPABASE_URL: z.url() });

    expect(schema.safeParse(withoutBlanks({ NEXT_PUBLIC_SUPABASE_URL: "" })).success).toBe(false);
  });
});
