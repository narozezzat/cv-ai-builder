import { ImageIcon, UserIcon } from "lucide-react";
import type { Metadata } from "next";

import { SectionCard } from "@/components/shared";
import { AvatarUploader, getProfile, ProfileForm } from "@/features/profile";
import { requireUser } from "@/services/supabase/server";

export const metadata: Metadata = {
  title: "Profile settings",
  description: "Your name, headline, and photo.",
  robots: { index: false, follow: false },
};

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  const profile = await getProfile();

  // The session's email is the fallback, not the source: `profiles.email` is kept in
  // step with `auth.users` by trigger, and a missing profile row must not blank the
  // field on the page that would let the user notice something is wrong.
  const email = profile?.email ?? user.email ?? "";

  return (
    <>
      <SectionCard
        icon={ImageIcon}
        title="Photo"
        description="A square image works best. PNG, JPEG, or WebP, up to 2 MB."
      >
        <AvatarUploader
          fullName={profile?.full_name ?? null}
          email={email}
          avatarUrl={profile?.avatar_url ?? null}
        />
      </SectionCard>

      <SectionCard
        icon={UserIcon}
        title="Profile"
        description="How you appear across Reforge and on the resumes you export."
      >
        <ProfileForm
          email={email}
          defaultValues={{
            fullName: profile?.full_name ?? "",
            headline: profile?.headline ?? "",
          }}
        />
      </SectionCard>
    </>
  );
}
