import {
  ActivityIcon,
  DownloadIcon,
  FileTextIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserIcon,
} from "lucide-react";
import type { ComponentType } from "react";

import { EmptyState } from "@/components/shared";
import type { ActivityLogRow } from "@/types/db";
import { formatDateTime, formatRelativeTime } from "@/utils/date";

import { activityLabel } from "../lib/activity";

/**
 * Icon per action namespace, not per action.
 *
 * Keyed on the part before the dot so a new `resume.*` or `ai.*` action gets a
 * sensible icon the day it ships, with no edit here. The map in `activityLabel`
 * degrades the same way for the same reason.
 */
const NAMESPACE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  auth: ShieldCheckIcon,
  profile: UserIcon,
  resume: FileTextIcon,
  ai: SparklesIcon,
  export: DownloadIcon,
};

function actionIcon(action: string): ComponentType<{ className?: string }> {
  return NAMESPACE_ICONS[action.split(".")[0] ?? ""] ?? ActivityIcon;
}

/**
 * The account's recent activity.
 *
 * Doubles as a security surface: "Signed in" and "Changed password" entries are how
 * a user notices access they didn't authorise, which is why auth events are logged
 * at all. That is also why the exact timestamp is in the `title` — "3 hours ago" is
 * friendlier to read but useless for deciding whether an entry was you.
 */
export function ActivityFeed({ items }: { items: ActivityLogRow[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        size="compact"
        icon={ActivityIcon}
        title="No activity yet"
        description="Sign-ins, edits, and exports will show up here as you use Reforge."
      />
    );
  }

  return (
    <ol className="-my-1 divide-y divide-border/60">
      {items.map((item) => {
        const Icon = actionIcon(item.action);

        return (
          <li key={item.id} className="flex items-center gap-3 py-2.5">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 ring-1 ring-foreground/5"
            >
              <Icon className="size-3.5 text-muted-foreground" />
            </span>

            <p className="min-w-0 flex-1 truncate text-sm">{activityLabel(item.action)}</p>

            <time
              dateTime={item.created_at}
              title={formatDateTime(item.created_at) ?? undefined}
              className="shrink-0 text-xs whitespace-nowrap text-muted-foreground"
            >
              {formatRelativeTime(item.created_at)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
