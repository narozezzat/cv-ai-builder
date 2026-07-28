import { PageHeader, ShimmerSkeleton } from "@/components/shared";

import { getProfile } from "../queries/profile-queries";

/**
 * First name only, for the greeting.
 *
 * A full legal name in a "Welcome back" line reads like a form letter, and a
 * headline-length `full_name` (users do put credentials in there) would wrap the
 * heading. Falls back to a name-free greeting rather than to "there", which sounds
 * like a mail merge that failed.
 */
function firstName(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];

  return first ? first : null;
}

/**
 * The dashboard's heading, streamed because it needs the profile row.
 *
 * `getProfile` is memoized per request, so this costs no extra round-trip on top of
 * the one the app shell already made for the header — the boundary here buys the
 * shell an earlier flush, not a second query.
 */
export async function DashboardGreeting() {
  const profile = await getProfile();
  const name = firstName(profile?.full_name);

  return (
    <PageHeader
      title={name ? `Welcome back, ${name}` : "Welcome back"}
      description="Pick up where you left off, or start something new."
    />
  );
}

/** Heading and description at their real heights, so the stats below don't jump. */
export function DashboardGreetingSkeleton() {
  return (
    <div role="status" aria-label="Loading your dashboard" className="space-y-2">
      <ShimmerSkeleton className="h-8 w-64" />
      <ShimmerSkeleton className="h-4 w-80" />
    </div>
  );
}
