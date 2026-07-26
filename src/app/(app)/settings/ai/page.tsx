import { SparklesIcon } from "lucide-react";
import type { Metadata } from "next";

import { SectionCard } from "@/components/shared";
import {
  AiCreditsCard,
  AiPreferencesForm,
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

      <AiCreditsCard credits={profile?.ai_credits ?? null} />
    </>
  );
}
