"use client";

import { useRouter } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import {
  ErrorBoundary,
  ErrorFallback,
  type FallbackProps,
} from "@/components/shared/error-boundary";

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
 *   <ResumeGridSection filters={filters} />
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
    <ErrorBoundary fallback={fallback ?? renderRetry} onError={onError} resetKeys={resetKeys}>
      <Suspense fallback={pending}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function renderRetry(props: FallbackProps) {
  return <RetryFallback {...props} />;
}

/**
 * The default fallback, wrapping `ErrorFallback` so "Try again" actually tries.
 *
 * `reset()` alone only clears the boundary's state and re-renders the same children —
 * which, when the child is a streamed Server Component, is the same already-rejected
 * payload. The retry has to ask the server for a new one, so it refreshes the route
 * first. Harmless for client children: a refresh revalidates data they were reading
 * anyway.
 */
function RetryFallback({ error, reset }: FallbackProps) {
  const router = useRouter();

  return (
    <ErrorFallback
      error={error}
      reset={() => {
        router.refresh();
        reset();
      }}
    />
  );
}
