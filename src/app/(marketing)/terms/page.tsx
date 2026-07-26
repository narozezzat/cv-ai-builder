import type { Metadata } from "next";

import { LegalPage, TERMS } from "@/features/marketing";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: TERMS.title,
  description: TERMS.description,
  alternates: { canonical: routes.terms },
};

export default function TermsPage() {
  return <LegalPage document={TERMS} />;
}
