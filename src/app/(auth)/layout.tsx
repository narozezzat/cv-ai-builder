import Link from "next/link";
import type { ReactNode } from "react";

import { Logo, ThemeToggle } from "@/components/shared";
import { routes } from "@/lib/routes";
import { siteConfig } from "@/lib/site";

/**
 * Chrome for the five auth screens.
 *
 * Deliberately not the marketing layout: no nav, no footer links, nothing to click
 * except the thing the user came here to do. The only escapes are the wordmark and
 * the legal line, both of which are obligations rather than distractions.
 *
 * `id="main"` is what the root layout's skip link targets. Every top-level layout
 * must provide it, or keyboard users land nowhere.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col">
      {/* Two decorative layers, both `pointer-events-none` so they never eat a
          click aimed at the card: a faint grid for texture and a brand-tinted
          bloom behind the card to lift it off the page. */}
      <div className="pointer-events-none absolute inset-0 -z-10 grid-pattern opacity-50" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 -z-10 size-144 -translate-x-1/2 rounded-full bg-brand/12 blur-[120px]"
      />

      <header className="flex items-center justify-between px-6 py-6">
        <Logo />
        <ThemeToggle />
      </header>

      <main id="main" className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        {children}
      </main>

      <footer className="px-6 py-8 text-center text-xs text-muted-foreground">
        <p className="text-balance">
          By continuing you agree to {siteConfig.name}&apos;s{" "}
          <Link href={routes.terms} className="underline decoration-border underline-offset-4">
            Terms
          </Link>{" "}
          and{" "}
          <Link href={routes.privacy} className="underline decoration-border underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}
