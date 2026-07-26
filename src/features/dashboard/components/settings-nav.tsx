"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: routes.settings, label: "Profile" },
  { href: routes.settingsAppearance, label: "Appearance" },
  { href: routes.settingsAi, label: "AI" },
  { href: routes.settingsAccount, label: "Account" },
] as const;

/**
 * Section switcher for the settings area.
 *
 * Real links rather than a `Tabs` primitive: each section is its own route, so it
 * must be openable in a new tab, bookmarkable, and reachable by the browser's back
 * button. Tabs would give the right visuals and the wrong semantics.
 *
 * Client-side only because of `usePathname` — the active state is the whole reason
 * this isn't markup in the layout.
 */
export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections">
      <ul className="flex gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1 ring-1 ring-foreground/5">
        {ITEMS.map((item) => {
          // Exact match: `/settings` is the profile tab, not an ancestor of the
          // others, so `startsWith` would light up all four at once.
          const active = pathname === item.href;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-1.5 text-center text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
