"use client";

import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface IconButtonProps extends Omit<ComponentProps<typeof Button>, "children" | "size"> {
  /**
   * Doubles as the tooltip text and the accessible name. Required — an icon-only
   * button with no label is invisible to screen readers (WCAG 4.1.2).
   */
  label: string;
  icon: ReactNode;
  size?: "icon-xs" | "icon-sm" | "icon" | "icon-lg";
  /** Keyboard hint appended to the tooltip, e.g. `⌘S`. */
  shortcut?: string;
  /** Suppress the tooltip when the button sits inside a menu that has its own. */
  tooltip?: boolean;
}

/**
 * Icon-only button with a tooltip and an accessible name, bundled so the label
 * can't be forgotten. The app has dozens of these in editor toolbars and card
 * overflow rows; making the label a required prop makes the a11y failure a
 * compile error rather than an audit finding.
 */
export function IconButton({
  label,
  icon,
  size = "icon",
  shortcut,
  tooltip = true,
  variant = "ghost",
  ...props
}: IconButtonProps) {
  const button = (
    <Button variant={variant} size={size} aria-label={label} {...props}>
      {icon}
    </Button>
  );

  if (!tooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>
        {label}
        {shortcut ? (
          <kbd className="rounded border border-background/20 bg-background/10 px-1 font-mono text-[0.7rem]">
            {shortcut}
          </kbd>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
