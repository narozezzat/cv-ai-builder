"use client";

import { SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  COMMAND_PALETTE_COMBO,
  useCommandPalette,
} from "@/components/providers/command-palette-provider";
import { useShortcutLabel } from "@/hooks/use-shortcuts";
import { cn } from "@/lib/utils";

interface CommandPaletteTriggerProps {
  className?: string;
}

/**
 * Opens the palette by pointer. Exists because a feature that is only reachable by
 * `⌘K` is a feature only the people who wrote it know about — the visible hint is
 * how the shortcut gets learned.
 *
 * Renders nothing outside the app shell: on marketing pages there is no provider and
 * therefore no palette, and a button that does nothing is worse than no button.
 */
export function CommandPaletteTrigger({ className }: CommandPaletteTriggerProps) {
  const palette = useCommandPalette();
  const shortcut = useShortcutLabel(COMMAND_PALETTE_COMBO);

  if (!palette) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => palette.setOpen(true)}
      // The accessible name has to carry the purpose on its own: the visible text is
      // hidden below `sm`, and the shortcut hint is absent until after hydration.
      aria-label="Open command palette"
      aria-keyshortcuts="Meta+K Control+K"
      className={cn("gap-2 text-muted-foreground", className)}
    >
      <SearchIcon aria-hidden />
      <span className="hidden sm:inline">Commands</span>
      {/*
        Reserved width even while the label is unknown, so the header doesn't reflow
        one frame after hydration when `⌘K` appears.
      */}
      <kbd className="hidden min-w-8 rounded border border-border bg-muted px-1 font-mono text-[0.7rem] leading-4 sm:inline-block">
        {shortcut ?? " "}
      </kbd>
    </Button>
  );
}
