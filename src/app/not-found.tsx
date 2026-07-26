import { ArrowLeft, LayoutTemplate } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { StatusPage } from "@/components/shared";
import { Button } from "@/components/ui/button";
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
          <Button size="lg" variant="brand" render={<Link href={routes.home} />}>
            <ArrowLeft data-icon="inline-start" />
            Back home
          </Button>
          <Button size="lg" variant="outline" render={<Link href={routes.templates} />}>
            <LayoutTemplate data-icon="inline-start" />
            Browse templates
          </Button>
        </>
      }
    />
  );
}
