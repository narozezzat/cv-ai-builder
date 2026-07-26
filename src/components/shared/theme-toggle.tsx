"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * `next-themes` can't know the resolved theme until after hydration, so any
 * icon rendered on the server is a coin flip. Gating on mount avoids a visible
 * icon swap; the placeholder keeps the layout from shifting.
 */
function useMountedTheme() {
  const [mounted, setMounted] = useState(false);
  const theme = useTheme();

  useEffect(() => setMounted(true), []);

  return { ...theme, mounted };
}

/**
 * Single-button toggle that flips light↔dark. For app chrome, where a
 * three-way control costs more space than it earns.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme, mounted } = useMountedTheme();

  if (!mounted) {
    return <div className={cn("size-8 shrink-0", className)} aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            className={className}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? <Sun /> : <Moon />}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Three-way segmented control including `system`. For the settings page, where
 * "follow my OS" needs to be an explicit, visible choice rather than an
 * invisible default.
 */
export function ThemeSelect({ className }: { className?: string }) {
  const { theme, setTheme, mounted } = useMountedTheme();

  return (
    <ToggleGroup
      variant="outline"
      spacing={0}
      className={cn("w-fit", className)}
      // Empty until mounted: rendering a selected segment before the stored
      // preference is known would flash the wrong option.
      value={mounted ? [theme ?? "system"] : []}
      onValueChange={(groupValue) => {
        const next = groupValue[0];
        // Base UI clears the array when the active item is re-pressed. Theme is
        // a required setting, so treat that as a no-op rather than "no theme".
        if (typeof next === "string") setTheme(next);
      }}
      aria-label="Theme"
    >
      {THEMES.map(({ value, label, icon: Icon }) => (
        <ToggleGroupItem key={value} value={value}>
          <Icon data-icon="inline-start" />
          {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
