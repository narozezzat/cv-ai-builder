import type { ComponentType, ReactNode } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: ReactNode;
  description?: ReactNode;
  /** Header-right slot — an "Add item" button, a visibility switch, a count badge. */
  action?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Drops the header padding for content that must run edge to edge (tables). */
  flush?: boolean;
}

/**
 * Titled panel used by the resume editor's section list and every settings
 * group. Composing `Card` here rather than at each call site keeps the header
 * layout, icon treatment, and heading level consistent across ~30 panels.
 */
export function SectionCard({
  title,
  description,
  action,
  icon: Icon,
  footer,
  children,
  className,
  contentClassName,
  flush = false,
}: SectionCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {Icon ? <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn(flush && "px-0", contentClassName)}>{children}</CardContent>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}
