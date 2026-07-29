import { SparklesIcon } from "lucide-react";
import type { Metadata } from "next";

import { AsyncBoundary, SectionCard } from "@/components/shared";
import {
  AiPreferencesForm,
  AiPrivacyNotice,
  AiUsageSection,
  AiUsageSkeleton,
  getProfile,
  parseAiPreferences,
} from "@/features/profile";

export const metadata: Metadata = {
  title: "AI settings",
  description: "Tone, length, and spelling for everything the AI writes.",
  robots: { index: false, follow: false },
};

export default async function AiSettingsPage() {
  const profile = await getProfile();

  return (
    <>
      <SectionCard
        icon={SparklesIcon}
        title="Writing style"
        description="Applied to every generation and rewrite, so you set it once instead of per resume."
      >
        <AiPreferencesForm defaultValues={parseAiPreferences(profile?.ai_preferences)} />
      </SectionCard>

      {/*
        Streamed separately: the ledger is a second query and the preferences form is
        the reason people open this page. A slow month of history should not hold the
        form back, and a failed read should degrade to a message in place of the
        ledger rather than taking the settings route to its error boundary.
      */}
      <AsyncBoundary pending={<AiUsageSkeleton />}>
        <AiUsageSection />
      </AsyncBoundary>

      <AiPrivacyNotice />
    </>
  );
}
