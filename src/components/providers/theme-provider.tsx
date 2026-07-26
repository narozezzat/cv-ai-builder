"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * localStorage key next-themes reads and writes.
 *
 * Exported and passed explicitly rather than left to the library default,
 * because the account's stored theme preference has to know whether this browser
 * has an opinion of its own before overriding it. A hard-coded `"theme"` at that
 * call site would silently stop matching if this provider ever changed.
 */
export const THEME_STORAGE_KEY = "theme";

/**
 * Wraps next-themes with the app's fixed configuration.
 *
 * `class` strategy is required: globals.css defines the dark palette under a
 * `.dark` selector via Tailwind's `@custom-variant`.
 *
 * `disableTransitionOnChange` prevents every colour token animating at once
 * when the theme flips, which otherwise reads as a full-page flash.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={THEME_STORAGE_KEY}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
