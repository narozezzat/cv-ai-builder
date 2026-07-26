import type { Transition, Variants } from "framer-motion";

/**
 * Single source of truth for animation. Components import variants from here
 * instead of inlining `initial`/`animate` objects, so timing stays consistent
 * and a change to the easing curve applies everywhere at once.
 *
 * Curves mirror the `--ease-*` custom properties in globals.css, keeping CSS
 * transitions and Framer Motion animations visually identical.
 */

/** Cubic bezier control points, matching the CSS `--ease-*` tokens. */
export const EASE = {
  /** Decelerating. Default for entrances — fast start, gentle settle. */
  out: [0.22, 1, 0.36, 1],
  /** Symmetric. For moves and reorders where both ends should feel equal. */
  inOut: [0.83, 0, 0.17, 1],
  /** Slight overshoot. Reserve for success and playful affordances. */
  spring: [0.34, 1.56, 0.64, 1],
} as const satisfies Record<string, [number, number, number, number]>;

/**
 * Duration scale in seconds. Anything above `slow` reads as sluggish for UI
 * feedback; anything below `fast` is imperceptible and wasted.
 */
export const DURATION = {
  instant: 0.12,
  fast: 0.18,
  base: 0.28,
  slow: 0.45,
  slower: 0.7,
} as const;

export const TRANSITION = {
  base: { duration: DURATION.base, ease: EASE.out },
  fast: { duration: DURATION.fast, ease: EASE.out },
  slow: { duration: DURATION.slow, ease: EASE.out },
  /** Physical feel for drag release and layout shifts. */
  spring: { type: "spring", stiffness: 400, damping: 32, mass: 0.8 },
  /** Softer spring for large surfaces (sheets, dialogs, page shells). */
  springSoft: { type: "spring", stiffness: 260, damping: 30, mass: 1 },
} as const satisfies Record<string, Transition>;

/* -------------------------------------------------------------------------- */
/*  Variants                                                                  */
/* -------------------------------------------------------------------------- */

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: TRANSITION.base },
  exit: { opacity: 0, transition: TRANSITION.fast },
};

/**
 * Vertical entrance. `distance` is a parameter rather than a magic number so
 * hero sections can travel further than list rows without a bespoke variant.
 */
export const fadeUp = (distance = 12): Variants => ({
  hidden: { opacity: 0, y: distance },
  visible: { opacity: 1, y: 0, transition: TRANSITION.base },
  exit: { opacity: 0, y: distance / 2, transition: TRANSITION.fast },
});

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: TRANSITION.base },
  exit: { opacity: 0, scale: 0.98, transition: TRANSITION.fast },
};

/** Dialog/popover surface: scale plus a small rise, so it feels anchored. */
export const overlayContent: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: TRANSITION.springSoft },
  exit: { opacity: 0, scale: 0.98, y: 4, transition: TRANSITION.fast },
};

/**
 * Parent for staggered children. Children must use `fadeUp()` (or any variant
 * with the same `hidden`/`visible` keys) and omit their own transition delay —
 * the stagger is orchestrated here.
 */
export const staggerContainer = (stagger = 0.06, delayChildren = 0): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

/** Card lift on pointer hover. Paired with a `shadow-md` → `shadow-lg` class. */
export const hoverLift = {
  rest: { y: 0, scale: 1 },
  hover: { y: -4, scale: 1.008, transition: TRANSITION.fast },
  tap: { scale: 0.995, transition: { duration: DURATION.instant } },
} as const satisfies Variants;

export const pressable = {
  rest: { scale: 1 },
  hover: { scale: 1.02, transition: TRANSITION.fast },
  tap: { scale: 0.97, transition: { duration: DURATION.instant } },
} as const satisfies Variants;

/** Route-level transition. Deliberately subtle — page changes should not wait. */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.out } },
  exit: { opacity: 0, y: -8, transition: { duration: DURATION.fast, ease: EASE.out } },
};

export const collapse: Variants = {
  hidden: { height: 0, opacity: 0, transition: TRANSITION.fast },
  visible: { height: "auto", opacity: 1, transition: TRANSITION.base },
};

/** Success confirmation — the one place overshoot is appropriate. */
export const successPop: Variants = {
  hidden: { scale: 0.6, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { duration: DURATION.slow, ease: EASE.spring },
  },
};

/* -------------------------------------------------------------------------- */
/*  Reduced motion                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Strips transforms from a variant set, keeping opacity. Users who ask for
 * reduced motion still get state-change feedback (WCAG 2.3.3) without the
 * movement that triggers vestibular discomfort.
 *
 * Prefer the `useMotionVariants` hook in components; this is the pure function
 * behind it, exported for use outside React and in tests.
 */
const MOTION_PROPERTIES = [
  "x",
  "y",
  "z",
  "scale",
  "scaleX",
  "scaleY",
  "rotate",
  "rotateX",
  "rotateY",
  "skew",
  "height",
  "width",
] as const;

export function withoutMotion(variants: Variants): Variants {
  const stripped: Variants = {};

  for (const [state, definition] of Object.entries(variants)) {
    if (typeof definition !== "object" || definition === null) {
      stripped[state] = definition;
      continue;
    }

    const preserved = Object.fromEntries(
      Object.entries(definition).filter(
        ([key]) => !MOTION_PROPERTIES.includes(key as (typeof MOTION_PROPERTIES)[number]),
      ),
    );

    stripped[state] = { ...preserved, transition: { duration: 0.01 } };
  }

  return stripped;
}
