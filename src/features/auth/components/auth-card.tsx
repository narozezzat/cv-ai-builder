import Link from "next/link";
import type { ReactNode } from "react";

import { FadeUp } from "@/components/shared";
import { cn } from "@/lib/utils";

/**
 * The frame every auth screen sits in.
 *
 * A Server Component on purpose: nothing here is interactive, so the five auth
 * pages ship only their form as client JavaScript. The card is a plain `<section>`
 * rather than `<Card>` because the auth surface wants a heavier, glassier
 * treatment than the dashboard's default card chrome.
 *
 * The heading is an `<h1>` — each auth page is a standalone document whose subject
 * is the action being taken, and the pages render no other top-level heading.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <FadeUp className="w-full max-w-md">
      <section
        className={cn(
          "rounded-2xl border border-border/60 p-6 shadow-lg glass sm:p-8",
          "supports-backdrop-filter:bg-background/70",
          className,
        )}
      >
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          {description ? (
            <p className="text-sm text-pretty text-muted-foreground">{description}</p>
          ) : null}
        </header>

        <div className="mt-6">{children}</div>

        {footer ? (
          <footer className="mt-6 border-t border-border/60 pt-5 text-center text-sm text-muted-foreground">
            {footer}
          </footer>
        ) : null}
      </section>
    </FadeUp>
  );
}

/**
 * The "already have an account?" line. Extracted because all five pages use one
 * and the link styling is fiddly enough that copies would drift.
 */
export function AuthCardLink({
  href,
  label,
  prompt,
}: {
  href: string;
  label: string;
  prompt: string;
}) {
  return (
    <>
      {prompt}{" "}
      <Link
        href={href}
        className="rounded font-medium text-foreground underline decoration-border underline-offset-4 transition-colors outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
      </Link>
    </>
  );
}
