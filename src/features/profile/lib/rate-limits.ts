/**
 * Rate-limit buckets for the profile surface.
 *
 * Nothing here is an authentication oracle, so the ceilings are set by cost rather
 * than by attack value: text updates are cheap and generous, avatar uploads write
 * to object storage and are not. Enforcement is `@/services/rate-limit`.
 */

import type { RateLimitRule } from "@/services/rate-limit";

export const PROFILE_RATE_LIMITS = {
  /** Covers name, headline, appearance, and AI preference saves together. */
  update: { action: "profile.update", window: "1 hour", max: 60 },
  /**
   * Each upload is a durable object in a public bucket. 20 an hour is more than
   * any real person needs and well short of a way to fill a bucket for free.
   */
  avatarUpload: { action: "profile.avatar_upload", window: "1 hour", max: 20 },
} satisfies Record<string, RateLimitRule>;
