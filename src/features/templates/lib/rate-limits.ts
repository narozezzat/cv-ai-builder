/**
 * Ceiling for the one write the template feature owns.
 *
 * A favourite is a two-column row with no cascading work, so the limit is not there to
 * protect the database — it is there because the star is a client-driven toggle, and an
 * unthrottled endpoint that writes on every click is exactly the shape a script uses to
 * fill a table. Generous enough that starring every one of twenty templates twice over
 * never trips it.
 */

import type { RateLimitRule } from "@/services/rate-limit";

export const TEMPLATE_RATE_LIMITS = {
  favorite: { action: "template.favorite", window: "1 hour", max: 120 },
} satisfies Record<string, RateLimitRule>;
