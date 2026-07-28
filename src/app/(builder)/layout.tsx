import type { ReactNode } from "react";

import { CommandPaletteProvider } from "@/components/providers/command-palette-provider";
import { getProfile, parseAppearance, ThemeSync } from "@/features/profile";
import { requireUser } from "@/services/supabase/server";

/**
 * Its own route group rather than a page under `(app)`.
 *
 * Two reasons. The editor supplies its own header — the dashboard's carries app nav,
 * and nav one click from unsaved work is a trap — and the editor owns the full
 * viewport height, which a layout that wraps `children` in a padded `<main>` cannot
 * give it. `id="main"` therefore lives on the editor's own `<main>`; the root
 * layout's skip link targets it either way.
 *
 * `requireUser()` for the same reason as `(app)`: middleware redirects anonymous
 * requests, but it is usability rather than authorization, and it cannot tell whether
 * the session cookie still names a live user.
 */
export default async function BuilderLayout({ children }: { children: ReactNode }) {
  await requireUser();

  const profile = await getProfile();
  const { theme } = parseAppearance(profile?.theme, profile?.locale);

  return (
    <CommandPaletteProvider>
      {children}
      <ThemeSync preference={theme} />
    </CommandPaletteProvider>
  );
}
