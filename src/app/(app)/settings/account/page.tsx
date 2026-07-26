import { ActivityIcon, KeyRoundIcon, LogOutIcon, MailIcon } from "lucide-react";
import type { Metadata } from "next";

import { SectionCard } from "@/components/shared";
import { ChangeEmailForm, ChangePasswordForm, SignOutButton } from "@/features/auth";
import { ActivityFeed, getRecentActivity } from "@/features/profile";
import { requireUser } from "@/services/supabase/server";

export const metadata: Metadata = {
  title: "Account settings",
  description: "Password, email address, and recent account activity.",
  robots: { index: false, follow: false },
};

export default async function AccountSettingsPage() {
  // The session, not the profile row: credentials belong to `auth.users`, and this
  // page must show the address GoTrue will actually email.
  const [user, activity] = await Promise.all([requireUser(), getRecentActivity(10)]);

  return (
    <>
      <SectionCard
        icon={KeyRoundIcon}
        title="Password"
        description="Changing it signs out your other sessions."
      >
        <ChangePasswordForm />
      </SectionCard>

      <SectionCard
        icon={MailIcon}
        title="Email address"
        description="Both the old and the new address have to confirm before the change takes effect."
      >
        <ChangeEmailForm currentEmail={user.email ?? ""} />
      </SectionCard>

      {/*
        Activity is repeated here, and shown deeper than on the dashboard, because
        this is the page a user opens when they suspect someone else has been in
        their account. Sign-in and password-change entries are the evidence.
      */}
      <SectionCard
        icon={ActivityIcon}
        title="Recent activity"
        description="Sign-ins and account changes. Something here you don't recognise? Change your password."
      >
        <ActivityFeed items={activity} />
      </SectionCard>

      <SectionCard
        icon={LogOutIcon}
        title="Sessions"
        description="Signing out clears this browser's session. Your work is already saved."
      >
        <SignOutButton variant="outline" />
      </SectionCard>
    </>
  );
}
