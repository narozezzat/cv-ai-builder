/**
 * The two halves of a `bullets.improve` round trip for one role's highlights.
 *
 * `bullets.improve` answers by index into *what it was sent*, and what it is sent is
 * not the field's array: blank rows are dropped, long bullets are truncated, and the
 * request stops at twelve. So the request order and the document order diverge the
 * moment a highlights list has a gap in it, and applying a result positionally would
 * write bullet 3's improvement into bullet 5.
 *
 * Both directions of that mapping live here — pure, so the index arithmetic is
 * testable without rendering the trigger that performs it.
 */

import { RESUME_LIMITS } from "@/types/resume";

/** `improveInputSchema.bullets` accepts at most twelve per request. */
export const MAX_IMPROVE_BULLETS = 12;

interface SubmittedBullet {
  /** Position in the field's array, which is not the position in the request. */
  documentIndex: number;
  text: string;
}

/** The bullets a request may carry: trimmed, non-blank, bounded, capped at twelve. */
function submittedBullets(highlights: readonly string[]): SubmittedBullet[] {
  const submitted: SubmittedBullet[] = [];

  highlights.forEach((bullet, documentIndex) => {
    if (submitted.length >= MAX_IMPROVE_BULLETS) return;

    const text = bullet.trim().slice(0, RESUME_LIMITS.highlightText);

    if (text.length > 0) submitted.push({ documentIndex, text });
  });

  return submitted;
}

/** What `bullets.improve` is sent for a role — the request's own index order. */
export function bulletsForRequest(highlights: readonly string[]): string[] {
  return submittedBullets(highlights).map((bullet) => bullet.text);
}

/**
 * The response folded back into the field's array, by index.
 *
 * Rebuilt from the current list rather than from the response, so a bullet the request
 * never carried — a blank row, or the thirteenth of a long list — survives accept
 * instead of being dropped by a wholesale replace. An index past the end of the request
 * is ignored; the action already reconciles the model's numbering against what it sent,
 * and this is the second line of that defence rather than a restatement of it.
 */
export function applyImprovedBullets(
  highlights: readonly string[],
  improved: readonly { index: number; text: string }[],
): string[] {
  const submitted = submittedBullets(highlights);
  const next = [...highlights];

  for (const bullet of improved) {
    const target = submitted[bullet.index];

    if (target) next[target.documentIndex] = bullet.text;
  }

  return next;
}
