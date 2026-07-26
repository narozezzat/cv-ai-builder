"use client";

import { Home, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { ButtonLink, StatusPage } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

/**
 * Route-level error boundary.
 *
 * `error.message` is deliberately not shown. In production Next replaces it with
 * a generic string anyway, but in development it can carry connection strings,
 * SQL, or table names — surfacing it in a component that also ships to
 * production is how that leaks. The `digest` is safe: it is a hash Next also
 * writes to the server log, so it lets a user quote something we can grep for.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Console for now; Phase 5 swaps this for the real reporter. Keeping the call
    // site here means that change is one line, not a hunt through boundaries.
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      code="Error"
      title="Something went wrong"
      description={
        <>
          The page failed to load. Trying again usually fixes it — your resume data is saved
          server-side, so nothing was lost.
          {error.digest ? (
            <span className="mt-3 block font-mono text-xs text-muted-foreground/70">
              Reference: {error.digest}
            </span>
          ) : null}
        </>
      }
      actions={
        <>
          <Button size="lg" variant="brand" onClick={reset}>
            <RotateCcw data-icon="inline-start" />
            Try again
          </Button>
          <ButtonLink size="lg" variant="outline" href={routes.home}>
            <Home data-icon="inline-start" />
            Back home
          </ButtonLink>
        </>
      }
    />
  );
}
