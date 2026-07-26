import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Lucide icon component. Passed as a type, not an element, so sizing is ours. */
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  /** The action that resolves the emptiness — "Create resume", "Clear filters". */
  action?: ReactNode;
  /** Secondary escape hatch, e.g. a link to docs or an import flow. */
  secondaryAction?: ReactNode;
  /**
   * `default` fills a page region; `compact` fits inside a card or panel where a
   * full-height illustration would blow out the layout.
   */
  size?: "default" | "compact";
  className?: string;
}

/**
 * Shown wherever a collection has no items, a search returns nothing, or a
 * filter excludes everything. Always name the reason and offer a way out — an
 * empty state without an action is a dead end.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  size = "default",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "default" ? "gap-4 px-6 py-16" : "gap-3 px-4 py-10",
        className,
      )}
    >
      {Icon ? (
        <div
          aria-hidden
          className={cn(
            "relative flex items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-foreground/5",
            size === "default" ? "size-14" : "size-11",
          )}
        >
          {/* Soft brand halo — keeps the empty state from reading as an error. */}
          <span className="absolute inset-0 rounded-2xl bg-brand/5" />
          <Icon
            className={cn(
              "relative text-muted-foreground",
              size === "default" ? "size-6" : "size-5",
            )}
          />
        </div>
      ) : null}

      <div className={cn("space-y-1.5", size === "default" ? "max-w-md" : "max-w-sm")}>
        <h3
          className={cn(
            "font-heading font-semibold text-balance",
            size === "default" ? "text-lg" : "text-base",
          )}
        >
          {title}
        </h3>
        {description ? (
          <p className="text-sm text-pretty text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {action || secondaryAction ? (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
