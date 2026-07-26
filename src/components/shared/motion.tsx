"use client";

import {
  animate as animateValue,
  motion,
  useMotionValue,
  type HTMLMotionProps,
  type Variants,
} from "framer-motion";
import { useEffect, useState, type ElementType, type ReactNode } from "react";

import { useAnimationEnabled, useMotionVariants } from "@/hooks/use-motion-variants";
import { DURATION, EASE, fadeIn, fadeUp, scaleIn, staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Declarative wrappers around the shared variants in `lib/motion.ts`.
 *
 * These exist so feature code never imports `framer-motion` directly for the
 * common cases. That keeps two guarantees centralized instead of restated at
 * every call site: reduced-motion stripping, and consistent timing.
 *
 * Reach for `motion.*` directly only for genuinely bespoke animation (drag,
 * layout projection, scroll-linked values).
 */

type MotionElement = Extract<ElementType, keyof typeof motion>;

interface RevealProps extends Omit<HTMLMotionProps<"div">, "variants"> {
  children: ReactNode;
  /**
   * Animate when scrolled into view rather than on mount. Fires once — a
   * section that re-animates every time it re-enters the viewport reads as a
   * glitch, not a flourish.
   */
  whenInView?: boolean;
  /** Seconds. Prefer `<Stagger>` over hand-tuning delays on siblings. */
  delay?: number;
  /** Render as a different element so semantics aren't sacrificed to animation. */
  as?: MotionElement;
}

function useRevealProps({ whenInView, delay }: Pick<RevealProps, "whenInView" | "delay">) {
  return whenInView
    ? {
        initial: "hidden" as const,
        whileInView: "visible" as const,
        viewport: { once: true, amount: 0.25 },
        transition: delay ? { delay } : undefined,
      }
    : {
        initial: "hidden" as const,
        animate: "visible" as const,
        transition: delay ? { delay } : undefined,
      };
}

/** Fade and rise. The default entrance for cards, sections, and list rows. */
export function FadeUp({
  children,
  className,
  whenInView = false,
  delay,
  distance = 12,
  as = "div",
  ...props
}: RevealProps & { distance?: number }) {
  const variants = useMotionVariants(fadeUp(distance));
  const Component = motion[as] as typeof motion.div;

  return (
    <Component
      className={className}
      variants={variants}
      {...useRevealProps({ whenInView, delay })}
      {...props}
    >
      {children}
    </Component>
  );
}

/** Opacity only. For content where movement would fight a fixed layout. */
export function FadeIn({
  children,
  className,
  whenInView = false,
  delay,
  as = "div",
  ...props
}: RevealProps) {
  const variants = useMotionVariants(fadeIn);
  const Component = motion[as] as typeof motion.div;

  return (
    <Component
      className={className}
      variants={variants}
      {...useRevealProps({ whenInView, delay })}
      {...props}
    >
      {children}
    </Component>
  );
}

/** Scale from 96%. For things that appear in place — badges, popovers, results. */
export function ScaleIn({
  children,
  className,
  whenInView = false,
  delay,
  as = "div",
  ...props
}: RevealProps) {
  const variants = useMotionVariants(scaleIn);
  const Component = motion[as] as typeof motion.div;

  return (
    <Component
      className={className}
      variants={variants}
      {...useRevealProps({ whenInView, delay })}
      {...props}
    >
      {children}
    </Component>
  );
}

interface StaggerProps extends RevealProps {
  /** Seconds between children. Above ~0.1 a long list feels slow to arrive. */
  stagger?: number;
}

/**
 * Orchestrates children's entrances. Children must be `<FadeUp>`/`<FadeIn>`/
 * `<ScaleIn>` (or any motion element using the same `hidden`/`visible` keys)
 * and must NOT set their own `initial`/`animate` — the parent drives them.
 *
 * @example
 * <Stagger>
 *   {items.map((item) => <FadeUp key={item.id}>{item.name}</FadeUp>)}
 * </Stagger>
 */
export function Stagger({
  children,
  className,
  whenInView = false,
  stagger = 0.06,
  delay = 0,
  as = "div",
  ...props
}: StaggerProps) {
  const variants = useMotionVariants(staggerContainer(stagger, delay));
  const Component = motion[as] as typeof motion.div;

  return (
    <Component
      className={className}
      variants={variants}
      initial="hidden"
      {...(whenInView
        ? { whileInView: "visible", viewport: { once: true, amount: 0.15 } }
        : { animate: "visible" })}
      {...props}
    >
      {children}
    </Component>
  );
}

/**
 * Child of `<Stagger>`. Identical to `<FadeUp>` minus the entrance triggers,
 * which the parent supplies. Using `<FadeUp>` inside `<Stagger>` would work but
 * its own `animate` would override the orchestration.
 */
export function StaggerItem({
  children,
  className,
  distance = 12,
  as = "div",
  ...props
}: Omit<RevealProps, "whenInView" | "delay"> & { distance?: number }) {
  const variants = useMotionVariants(fadeUp(distance));
  const Component = motion[as] as typeof motion.div;

  return (
    <Component className={className} variants={variants} {...props}>
      {children}
    </Component>
  );
}

/**
 * Counter that tweens to `value` instead of snapping. Used by dashboard stat
 * cards, where the count-up draws the eye to numbers that changed.
 *
 * Renders the final value directly under reduced motion, and on the server, so
 * the number is always in the HTML for crawlers and screen readers.
 */
export function AnimatedNumber({
  value,
  className,
  duration = DURATION.slower,
  format = (n: number) => Math.round(n).toLocaleString(),
}: {
  value: number;
  className?: string;
  duration?: number;
  format?: (value: number) => string;
}) {
  const animate = useAnimationEnabled();
  const count = useMotionValue(0);
  const [display, setDisplay] = useState(() => format(value));

  useEffect(() => {
    if (!animate) {
      setDisplay(format(value));
      return;
    }

    const controls = animateValue(count, value, { duration, ease: EASE.out });
    const unsubscribe = count.on("change", (latest) => setDisplay(format(latest)));

    return () => {
      controls.stop();
      unsubscribe();
    };
    // `format` is intentionally excluded: an inline formatter would be a new
    // function identity every render and restart the tween forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, count, duration, value]);

  return <span className={cn("tabular-nums", className)}>{display}</span>;
}

export type { RevealProps, StaggerProps };
export { motion, type Variants };
