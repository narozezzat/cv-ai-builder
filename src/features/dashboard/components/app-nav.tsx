"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: routes.dashboard, label: "Overview" },
  { href: routes.resumes, label: "Resumes" },
] as const;

/**
 * Section switcher for the signed-in app.
 *
 * Same shape as `SettingsNav` and for the same reasons: each section is a route,
 * so these must be real links, and the active state is the only thing forcing a
 * client component.
 *
 * Trash is deliberately absent. It is reachable from the resumes page, and a
 * top-level tab for a bin the user visits twice a year spends the header's
 * scarcest real estate on its least-used destination.
 */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="App sections">
      <ul className="flex gap-1 overflow-x-auto">
        {ITEMS.map((item) => {
          // `/dashboard` is an ancestor of `/dashboard/resumes`, so `startsWith`
          // would light both up. Overview matches exactly; the others own their
          // subtrees.
          const active =
            item.href === routes.dashboard
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "bg-accent text-accent-foreground"
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
