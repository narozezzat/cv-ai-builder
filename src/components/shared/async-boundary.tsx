"use client";

import { Suspense, type ReactNode } from "react";

import { ErrorBoundary, type FallbackProps } from "@/components/shared/error-boundary";

interface AsyncBoundaryProps {
  children: ReactNode;
  /** Shown while suspended. Use a skeleton that matches the real content's shape. */
  pending: ReactNode;
  /** Shown when a descendant throws. Defaults to the shared `ErrorFallback`. */
  fallback?: (props: FallbackProps) => ReactNode;
  onError?: (error: Error) => void;
  resetKeys?: readonly unknown[];
}

/**
 * Suspense and error handling as one unit, because an async region needs both:
 * a bare `<Suspense>` turns a failed fetch into a blank space, and a bare error
 * boundary leaves streamed content with no loading state.
 *
 * Order matters — the error boundary wraps Suspense so a promise that rejects
 * after suspending is caught rather than escaping to the route.
 *
 * @example
 * <AsyncBoundary pending={<ResumeGridSkeleton />}>
 *   <ResumeGrid />
 * </AsyncBoundary>
 */
export function AsyncBoundary({
  children,
  pending,
  fallback,
  onError,
  resetKeys,
}: AsyncBoundaryProps) {
  return (
    <ErrorBoundary fallback={fallback} onError={onError} resetKeys={resetKeys}>
      <Suspense fallback={pending}>{children}</Suspense>
    </ErrorBoundary>
  );
}
