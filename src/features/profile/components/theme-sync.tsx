"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

import { THEME_STORAGE_KEY } from "@/components/providers/theme-provider";

import type { ThemePreference } from "../schema/profile-schema";

/**
 * Adopts the account's saved theme on a browser that has no opinion of its own.
 *
 * `next-themes` is device-local by design — it reads `localStorage` and nothing
 * else. So a user who picks Dark on their laptop and then signs in on a phone gets
 * the phone's default, which reads as the setting having been ignored.
 *
 * The guard is the point: it applies the server value *only* when this browser has
 * never stored a preference. Without that check the stored value would fight the
 * local one on every page load, and a theme changed here would snap back on the
 * next navigation. Whichever choice was made most recently on this device wins,
 * because that device's choice is the one written to `localStorage` and to the
 * profile row together.
 *
 * Rendered once in the authenticated layout, renders nothing.
 */
export function ThemeSync({ preference }: { preference: ThemePreference }) {
  const { setTheme } = useTheme();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) {
      return;
    }

    applied.current = true;

    // `null` means untouched. `"system"` is stored explicitly by next-themes when
    // chosen, so an empty slot is genuinely "this browser has never been asked".
    if (window.localStorage.getItem(THEME_STORAGE_KEY) === null) {
      setTheme(preference);
    }
  }, [preference, setTheme]);

  return null;
}
