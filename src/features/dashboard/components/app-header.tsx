import Link from "next/link";

import { Logo, ThemeToggle } from "@/components/shared";
import { UserMenu } from "@/features/profile";
import { routes } from "@/lib/routes";

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
 * The section nav lands with the routes it points at, in the resume phase. A header
 * link that 404s is worse than a header without it.
 */
export function AppHeader({ fullName, email, avatarUrl }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href={routes.dashboard}
          className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          aria-label="Reforge dashboard"
        >
          <Logo />
        </Link>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu fullName={fullName} email={email} avatarUrl={avatarUrl} />
        </div>
      </div>
    </header>
  );
}
