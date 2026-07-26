"use client";

import { useMemo } from "react";
import { useReducedMotion, type Variants } from "framer-motion";

import { withoutMotion } from "@/lib/motion";

/**
 * Returns the given variants, transform-stripped when the user has asked for
 * reduced motion.
 *
 * Every animated component should route its variants through this hook rather
 * than reading the media query itself — that keeps the accessibility guarantee
 * in one place instead of relying on each component to remember it.
 *
 * @example
 * const variants = useMotionVariants(fadeUp(16));
 * return <motion.div variants={variants} initial="hidden" animate="visible" />;
 */
export function useMotionVariants(variants: Variants): Variants {
  const prefersReducedMotion = useReducedMotion();

  return useMemo(
    () => (prefersReducedMotion ? withoutMotion(variants) : variants),
    [prefersReducedMotion, variants],
  );
}

/**
 * Reduced-motion-aware boolean for cases where variants are not the right
 * abstraction — e.g. deciding whether to run an infinite background loop or
 * enable smooth-scroll behaviour imperatively.
 */
export function useAnimationEnabled(): boolean {
  return !useReducedMotion();
}
