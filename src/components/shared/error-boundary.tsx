"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FallbackProps {
  error: Error;
  /** Clears the error and re-renders children. */
  reset: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback. Receives the error and a reset callback. */
  fallback?: (props: FallbackProps) => ReactNode;
  /** Hook for error reporting. Runs in `componentDidCatch`. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /**
   * When any value in this array changes, the boundary clears its error. Pass
   * the route pathname or a query key so navigating away from a broken view
   * doesn't leave the fallback stuck on screen.
   */
  resetKeys?: readonly unknown[];
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Class component because `componentDidCatch` has no hook equivalent — React
 * still offers no function-component API for catching render errors.
 *
 * Prefer `<AsyncBoundary>`, which pairs this with Suspense. Use this directly
 * only when a region needs error handling but not a loading state.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys } = this.props;

    if (!this.state.error || !resetKeys) return;

    const changed =
      prevProps.resetKeys?.length !== resetKeys.length ||
      resetKeys.some((key, index) => key !== prevProps.resetKeys?.[index]);

    if (changed) this.reset();
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (!error) return children;
    if (fallback) return fallback({ error, reset: this.reset });

    return <ErrorFallback error={error} reset={this.reset} />;
  }
}

/**
 * Default error UI. Exported so `error.tsx` route files can reuse the exact
 * same presentation as in-page boundaries.
 *
 * The message is only shown in development: production error messages can leak
 * internals, and Next.js redacts server error messages anyway.
 */
export function ErrorFallback({
  error,
  reset,
  title = "Something went wrong",
  description = "This section failed to load. Retrying usually fixes it.",
  className,
}: FallbackProps & {
  title?: string;
  description?: string;
  className?: string;
}) {
  const showDetail = process.env.NODE_ENV === "development";

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl bg-card px-6 py-12 text-center ring-1 ring-foreground/10",
        className,
      )}
    >
      <div
        aria-hidden
        className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive"
      >
        <AlertTriangle className="size-5" />
      </div>

      <div className="max-w-md space-y-1.5">
        <h3 className="font-heading text-base font-semibold text-balance">{title}</h3>
        <p className="text-sm text-pretty text-muted-foreground">{description}</p>
      </div>

      {showDetail ? (
        <pre className="max-w-full overflow-x-auto rounded-lg bg-muted px-3 py-2 text-left font-mono text-xs text-muted-foreground">
          {error.message}
        </pre>
      ) : null}

      <Button variant="outline" size="lg" onClick={reset}>
        <RotateCcw data-icon="inline-start" />
        Try again
      </Button>
    </div>
  );
}

export type { FallbackProps };
