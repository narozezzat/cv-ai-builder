import type { ReactNode } from "react";

import { CommandPaletteProvider } from "@/components/providers/command-palette-provider";
import { AppHeader } from "@/features/dashboard";
import { getProfile, parseAppearance, ThemeSync } from "@/features/profile";
import { requireUser } from "@/services/supabase/server";

/**
 * Chrome for every signed-in page.
 *
 * `requireUser()` runs here rather than in each page: middleware already redirects
 * anonymous requests, but middleware is usability — it can be bypassed by anything
 * that reaches a route handler directly, and it does not know whether the session
 * cookie still corresponds to a live user. This call does, and every page under the
 * group inherits it.
 *
 * The profile read is the same one the header needs, so guarding and rendering cost
 * one round-trip between them.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const profile = await getProfile();

  // `theme`/`locale` are `text` behind a check constraint, so PostgREST types them
  // as plain strings; this narrows them without letting a stale row break the page.
  const { theme } = parseAppearance(profile?.theme, profile?.locale);

  return (
    /*
      The palette wraps the whole shell rather than sitting in the header: pages under
      this group register their own commands into it, and a provider mounted inside the
      header would be above them in the tree but not around them.
    */
    <CommandPaletteProvider>
      <div className="flex min-h-svh flex-col">
        <AppHeader
          fullName={profile?.full_name ?? null}
          email={profile?.email ?? user.email ?? null}
          avatarUrl={profile?.avatar_url ?? null}
        />

        {/*
          `id="main"` is what the root layout's skip link targets. Every top-level
          layout must provide it, or keyboard users land nowhere.
        */}
        <main id="main" className="flex-1">
          {children}
        </main>

        <ThemeSync preference={theme} />
      </div>
    </CommandPaletteProvider>
  );
}
