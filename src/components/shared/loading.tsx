import { Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading vocabulary for the whole app. Three tools, three jobs:
 *
 * - `Spinner` — indeterminate work inside a control (a submitting button).
 * - `Skeleton*` — content whose shape we know, so the layout doesn't jump.
 * - `LoadingOverlay` — blocking a region that already has content on screen.
 *
 * Prefer skeletons over spinners for page and section loads: a spinner tells
 * the user to wait, a skeleton tells them what they're waiting for.
 */

const SPINNER_SIZES = {
  xs: "size-3",
  sm: "size-4",
  default: "size-5",
  lg: "size-6",
} as const;

export function Spinner({
  size = "default",
  className,
  label,
}: {
  size?: keyof typeof SPINNER_SIZES;
  className?: string;
  /**
   * Announced to screen readers. Omit when a visible sibling already names the
   * pending action, so the same thing isn't read twice.
   */
  label?: string;
}) {
  return (
    <>
      <Loader2
        aria-hidden
        className={cn("animate-spin text-current", SPINNER_SIZES[size], className)}
      />
      {label ? (
        <span role="status" className="sr-only">
          {label}
        </span>
      ) : null}
    </>
  );
}

/**
 * Skeleton with a travelling sheen rather than a pulse. Reads as "loading"
 * more clearly than opacity alone, and the `shimmer` utility already degrades
 * to static under `prefers-reduced-motion`.
 */
export function ShimmerSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("shimmer bg-muted/70", className)} />;
}

/** Placeholder for a run of prose. The last line is short, like real text. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }, (_, index) => (
        <ShimmerSkeleton
          key={index}
          className={cn("h-3.5", index === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

/** Placeholder matching the `Card` primitive's padding and radius. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10", className)}
    >
      <div className="flex items-center gap-3">
        <ShimmerSkeleton className="size-9 rounded-lg" />
        <div className="flex-1 space-y-2">
          <ShimmerSkeleton className="h-3.5 w-1/3" />
          <ShimmerSkeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

/**
 * Grid of card skeletons. The dashboard resume grid and the template gallery
 * both suspend into this, so their loading states stay identical.
 */
export function SkeletonGrid({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
    >
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

/**
 * Scrim over a region that is being refetched or mutated. Keeps existing
 * content visible — and legible — instead of replacing it with a skeleton,
 * which would read as data loss.
 *
 * The parent must be `relative`.
 */
export function LoadingOverlay({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[inherit] bg-background/70 backdrop-blur-sm",
        className,
      )}
    >
      <Spinner className="text-brand" />
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Full-region loading state for a route-level `loading.tsx` where no meaningful
 * skeleton exists (an editor shell, an OAuth callback).
 */
export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3"
    >
      <Spinner size="lg" className="text-brand" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
