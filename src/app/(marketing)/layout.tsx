import { SiteFooter, SiteHeader } from "@/features/marketing";

/**
 * Chrome for the public pages. A route group, so the URL stays `/` — the parens
 * are organisational and never appear in a path.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      {/*
        `id="main"` is what the root layout's skip link targets. Every top-level
        layout must provide it, or keyboard users land nowhere.
      */}
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
