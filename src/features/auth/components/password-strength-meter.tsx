"use client";

import { CheckIcon, CircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { PASSWORD_RULES, scorePassword } from "../schema/password";

/** One bar per point `scorePassword` can award. */
const SEGMENTS = [1, 2, 3, 4] as const;

/**
 * Colour is a redundant signal here, never the only one: the score always ships
 * with a text label beside it, and each rule ships with an icon plus visually
 * hidden "met" / "not met" text. That is what makes the meter usable for someone
 * who cannot distinguish the amber bar from the green one.
 */
const SEGMENT_COLOURS: Record<number, string> = {
  1: "bg-destructive",
  2: "bg-amber-500",
  3: "bg-emerald-500",
  4: "bg-emerald-500",
};

/**
 * Live feedback on password quality, driven by the same rules the schema enforces.
 *
 * Both halves come from `scorePassword`, so the meter cannot say "Strong" about a
 * password the form is about to reject — the failure mode of every strength meter
 * that estimates entropy independently of its own validation.
 *
 * Only the label sits in a live region. Putting the checklist in one would
 * re-announce three items on every keystroke, which is worse than silence; the
 * label changes at most four times across the whole interaction.
 */
export function PasswordStrengthMeter({ value, className }: { value: string; className?: string }) {
  const { score, label, satisfied } = scorePassword(value);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {SEGMENTS.map((segment) => (
            <span
              key={segment}
              className={cn(
                "h-1 flex-1 rounded-full bg-muted transition-colors duration-300",
                segment <= score && SEGMENT_COLOURS[score],
              )}
            />
          ))}
        </div>
        <p aria-live="polite" className="w-16 text-right text-xs font-medium text-muted-foreground">
          {label}
        </p>
      </div>

      <ul className="grid gap-1">
        {PASSWORD_RULES.map((rule) => {
          const met = satisfied.includes(rule.id);

          return (
            <li
              key={rule.id}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors",
                met ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {met ? (
                <CheckIcon className="size-3 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <CircleIcon className="size-3" />
              )}
              <span className="sr-only">{met ? "Met:" : "Not met:"}</span>
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
