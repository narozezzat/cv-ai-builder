/**
 * Per-action ceilings for everything the resume feature writes.
 *
 * Sized by cost, not by feel. `save` is the loose one on purpose: autosave fires
 * on a 1.5s debounce, so a user typing continuously for five minutes legitimately
 * lands ~200 writes, and a limit tuned for a human clicking a button would break
 * the editor for the fastest typists first. `delete` is the tight one, because a
 * permanent delete also touches storage and is the only unrecoverable action here.
 *
 * The counter lives in Postgres (`check_rate_limit`), so these are per-user and
 * survive a redeploy — see `@/services/rate-limit`.
 */

import type { RateLimitRule } from "@/services/rate-limit";

export const RESUME_RATE_LIMITS = {
  /** Creating and duplicating both mint a row plus a document. */
  create: { action: "resume.create", window: "1 hour", max: 60 },
  /** Rename, favourite, tags, folder, trash, restore — cheap metadata writes. */
  mutate: { action: "resume.mutate", window: "1 hour", max: 240 },
  /** Autosave. Debounced at 1.5s, so the practical ceiling is ~40/minute. */
  save: { action: "resume.save", window: "5 minutes", max: 300 },
  /** Permanent delete, including emptying the trash. Unrecoverable. */
  delete: { action: "resume.delete", window: "1 hour", max: 30 },
  /** Folder create, rename, delete. */
  folder: { action: "resume.folder", window: "1 hour", max: 60 },
} satisfies Record<string, RateLimitRule>;
