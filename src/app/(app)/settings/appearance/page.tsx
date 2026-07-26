import { SwatchBookIcon } from "lucide-react";
import type { Metadata } from "next";

import { SectionCard } from "@/components/shared";
import { AppearanceForm, getProfile, parseAppearance } from "@/features/profile";

export const metadata: Metadata = {
  title: "Appearance settings",
  description: "Theme and language.",
  robots: { index: false, follow: false },
};

export default async function AppearanceSettingsPage() {
  const profile = await getProfile();

  return (
    <SectionCard
      icon={SwatchBookIcon}
      title="Appearance"
      description="Saved to your account, so a new device starts the way you left off."
    >
      <AppearanceForm defaultValues={parseAppearance(profile?.theme, profile?.locale)} />
    </SectionCard>
  );
}
