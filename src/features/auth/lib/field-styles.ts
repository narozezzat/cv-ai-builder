/**
 * Sizing shared by every auth control.
 *
 * The auth surface runs one notch larger than the app chrome — `h-9` fields and
 * `size="lg"` buttons instead of the `h-8` / `size="default"` defaults. The compact
 * scale is tuned for dense editor panels; on a single centred card holding four
 * controls it reads as cramped, and these are the highest-stakes inputs in the
 * product. It lives here rather than in each form so the five screens cannot drift
 * a pixel apart.
 */

export const AUTH_FIELD_HEIGHT = "h-9";

/** Passed to `<Button>` / `<SubmitButton>` on every auth screen. */
export const AUTH_BUTTON_SIZE = "lg" as const;
