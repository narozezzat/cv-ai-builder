import { Logo, ThemeToggle } from "@/components/shared";
import { UserMenu } from "@/features/profile";
import { routes } from "@/lib/routes";

import { AppNav } from "./app-nav";

interface AppHeaderProps {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

/**
 * Chrome for every signed-in page.
 *
 * Deliberately not the marketing header: that one animates a border in on scroll
 * and therefore needs a client scroll listener. Here the border is permanent —
 * an app that scrolls constantly shouldn't be recalculating chrome — so this stays
 * a server component and ships no JavaScript of its own.
 *
 */
export function AppHeader({ fullName, email, avatarUrl }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/*
          `href` rather than wrapping in a `<Link>`: `Logo` renders its own anchor,
          and nesting one inside another is invalid HTML — the browser closes the
          outer `<a>` early, which leaves the wordmark outside the link and gives
          screen readers two overlapping link nodes for one target.
        */}
        <Logo href={routes.dashboard} />

        {/* Always rendered: these two are the only routes into the app's content,
            and the user menu carries settings links but not these. `min-w-0`
            lets it shrink rather than push the account menu off a narrow screen. */}
        <div className="min-w-0 flex-1">
          <AppNav />
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu fullName={fullName} email={email} avatarUrl={avatarUrl} />
        </div>
      </div>
    </header>
  );
}
