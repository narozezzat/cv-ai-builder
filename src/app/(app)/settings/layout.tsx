import type { ReactNode } from "react";

import { PageHeader } from "@/components/shared";
import { SettingsNav } from "@/features/dashboard";

/**
 * Frame shared by every settings route.
 *
 * The `<h1>` lives here rather than in each page: "Settings" is the heading for all
 * four, and the tab label already says which section you are in. Repeating it per
 * page would mean four headings that have to be kept in step for no benefit.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        title="Settings"
        description="Your account, how the app looks, and how the AI writes."
      />

      <SettingsNav />

      <div className="space-y-4">{children}</div>
    </div>
  );
}
