import type { Metadata } from "next";

import { LegalPage, PRIVACY } from "@/features/marketing";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: PRIVACY.title,
  description: PRIVACY.description,
  alternates: { canonical: routes.privacy },
};

export default function PrivacyPage() {
  return <LegalPage document={PRIVACY} />;
}
