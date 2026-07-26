import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Primary and secondary actions, right-aligned on desktop. */
  actions?: ReactNode;
  /** Breadcrumbs or a back link, rendered above the title. */
  eyebrow?: ReactNode;
  className?: string;
}

/**
 * The single title block for every app page. Centralizing it means heading
 * levels, type scale, and the action-slot layout can't drift between routes.
 *
 * Server component — headers are static content. Interactive `actions` are
 * passed in as already-client children.
 */
export function PageHeader({ title, description, actions, eyebrow, className }: PageHeaderProps) {
  return (
    <div
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? (
          <div className="text-sm font-medium text-muted-foreground">{eyebrow}</div>
        ) : null}
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
