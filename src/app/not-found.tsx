import { ArrowLeft, LayoutTemplate } from "lucide-react";
import type { Metadata } from "next";

import { ButtonLink, StatusPage } from "@/components/shared";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Page not found",
  // A 404 that can be indexed dilutes the site's real pages.
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="We couldn't find that page"
      description="The link may be out of date, or the resume it pointed to was deleted or made private."
      actions={
        <>
          <ButtonLink size="lg" variant="brand" href={routes.home}>
            <ArrowLeft data-icon="inline-start" />
            Back home
          </ButtonLink>
          <ButtonLink size="lg" variant="outline" href={routes.templates}>
            <LayoutTemplate data-icon="inline-start" />
            Browse templates
          </ButtonLink>
        </>
      }
    />
  );
}
