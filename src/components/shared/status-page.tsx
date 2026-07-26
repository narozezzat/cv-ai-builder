import { cn } from "@/lib/utils";

interface StatusPageProps extends React.ComponentProps<"main"> {
  /** Short machine-ish label — a status code, or a word like "Error". */
  code: string;
  title: string;
  description: React.ReactNode;
  /** Buttons or links. Passed in rather than configured so callers keep control. */
  actions?: React.ReactNode;
}

/**
 * Full-viewport terminal state: 404, unhandled error, expired share link.
 *
 * Rendered as the `<main id="main">` element itself, which is the contract the
 * root layout's skip link depends on — `not-found.tsx` and `error.tsx` replace
 * the page, not the layout, so if they did not carry a `main` landmark the skip
 * link would target nothing.
 *
 * No animation here on purpose. These screens appear when something already went
 * wrong; a staggered reveal on an error message reads as decoration.
 */
export function StatusPage({
  code,
  title,
  description,
  actions,
  className,
  ...props
}: StatusPageProps) {
  return (
    <main
      id="main"
      className={cn(
        "relative flex min-h-svh flex-1 flex-col items-center justify-center px-6 py-24 text-center",
        className,
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 grid-pattern opacity-60" />

      <p className="text-gradient-brand text-7xl font-semibold tracking-tight tabular-nums sm:text-8xl">
        {code}
      </p>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">{description}</p>

      {actions ? (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">{actions}</div>
      ) : null}
    </main>
  );
}
