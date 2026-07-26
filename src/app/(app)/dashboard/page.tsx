import { ActivityIcon } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader, SectionCard } from "@/components/shared";
import { StatCards } from "@/features/dashboard";
import {
  ActivityFeed,
  AiCreditsCard,
  getDashboardStats,
  getProfile,
  getRecentActivity,
} from "@/features/profile";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your resumes, AI credits, and recent activity.",
  // Signed-in pages must never be indexed, and a canonical URL would invite it.
  robots: { index: false, follow: false },
};

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

export default async function DashboardPage() {
  // Independent reads, so they overlap rather than queue. Two of them resolve the
  // session, but `getUser()` is memoized per request.
  const [profile, stats, activity] = await Promise.all([
    getProfile(),
    getDashboardStats(),
    getRecentActivity(6),
  ]);

  const name = firstName(profile?.full_name);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title={name ? `Welcome back, ${name}` : "Welcome back"}
        description="Pick up where you left off, or start something new."
      />

      <StatCards stats={stats} />

      <div className="grid gap-3 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          icon={ActivityIcon}
          title="Recent activity"
          description="The last few things that happened on your account."
        >
          <ActivityFeed items={activity} />
        </SectionCard>

        <AiCreditsCard credits={profile?.ai_credits ?? null} />
      </div>
    </div>
  );
}
