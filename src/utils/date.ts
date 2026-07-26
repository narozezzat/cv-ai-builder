/**
 * Date formatting used across the dashboard, activity feed, and resume lists.
 *
 * Everything takes an ISO string, because that is what Postgres returns through
 * PostgREST and converting once at the edge of the UI is cheaper than threading
 * `Date` objects through server/client boundaries — a `Date` does not survive
 * serialization into a client component without being rehydrated anyway.
 *
 * Callers should render the result inside `<time dateTime={iso}>`: the visible
 * text is a formatted snapshot, the attribute is the machine-readable truth.
 */

const RELATIVE_UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "week", ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
];

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const dateOnly = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const dateAndTime = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * "3 hours ago", "yesterday", "in 2 days".
 *
 * Computed against `now`, which defaults to the current time but is injectable so
 * tests are not time-dependent. Rendered on the server and not recomputed on the
 * client, so the worst case is a string that is a few minutes stale rather than a
 * hydration mismatch.
 */
export function formatRelativeTime(
  iso: string | null | undefined,
  now: Date = new Date(),
): string | null {
  const date = toDate(iso);

  if (!date) {
    return null;
  }

  const diff = date.getTime() - now.getTime();
  const magnitude = Math.abs(diff);

  for (const { unit, ms } of RELATIVE_UNITS) {
    if (magnitude >= ms) {
      return relative.format(Math.round(diff / ms), unit);
    }
  }

  // Under a minute. "in 0 seconds" is worse than saying so plainly.
  return "just now";
}

/** "12 Mar 2026" — for anything a user might want to read as a calendar date. */
export function formatDate(iso: string | null | undefined): string | null {
  const date = toDate(iso);

  return date ? dateOnly.format(date) : null;
}

/** "12 Mar 2026, 4:05 PM" — for audit-style rows where the hour matters. */
export function formatDateTime(iso: string | null | undefined): string | null {
  const date = toDate(iso);

  return date ? dateAndTime.format(date) : null;
}
