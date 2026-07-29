/**
 * Ceiling on rendering.
 *
 * Unlike a favourite toggle, an export is genuinely expensive: it boots Chromium, loads
 * a page, rasterises or paginates it, and writes a file to storage. An unthrottled export
 * endpoint is a way to spend our CPU and our storage quota from a loop, so the limit here
 * is protecting the renderer, not the row.
 *
 * Twenty an hour is far above real use — a user tweaks and re-downloads a handful of
 * times before sending — and far below what a script needs to be worth writing.
 */

import type { RateLimitRule } from "@/services/rate-limit";

export const EXPORT_RATE_LIMITS = {
  render: { action: "export.render", window: "1 hour", max: 20 },
} satisfies Record<string, RateLimitRule>;
