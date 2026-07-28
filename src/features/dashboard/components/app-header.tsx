import { CommandPaletteTrigger, Logo, ThemeToggle } from "@/components/shared";
import { UserMenu } from "@/features/profile";
import { routes } from "@/lib/routes";

import { AppNav } from "./app-nav";
import { MobileNav } from "./mobile-nav";

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
        <Logo href={routes.dashboard} />

        {/* Desktop navigation: visible on sm and up */}
        <div className="hidden min-w-0 flex-1 sm:flex sm:items-center sm:justify-start">
          <AppNav />
        </div>

        {/* Desktop quick actions: visible on sm and up */}
        <div className="hidden items-center gap-1 sm:flex">
          <CommandPaletteTrigger className="mr-1" />
          <ThemeToggle />
          <UserMenu fullName={fullName} email={email} avatarUrl={avatarUrl} />
        </div>

        {/* Mobile drawer navigation: visible on mobile (< sm) */}
        <div className="flex items-center gap-2 sm:hidden">
          <MobileNav
            userMenu={<UserMenu fullName={fullName} email={email} avatarUrl={avatarUrl} />}
          />
        </div>
      </div>
    </header>
  );
}
