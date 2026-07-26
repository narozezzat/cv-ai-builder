import Link from "next/link";

import { GitHubIcon, Logo, XIcon } from "@/components/shared";
import { routes } from "@/lib/routes";
import { siteConfig } from "@/lib/site";

/**
 * Footer link groups.
 *
 * Only routes that exist (or are planned in a named phase) appear here — a
 * footer full of dead links is worse than a short footer.
 */
const FOOTER_GROUPS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Templates", href: "#templates" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Log in", href: routes.login },
      { label: "Create account", href: routes.signup },
      { label: "Reset password", href: routes.forgotPassword },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto w-full max-w-6xl px-6 py-14">
        <div className="flex flex-col gap-12 md:flex-row md:justify-between">
          <div className="max-w-xs space-y-4">
            <Logo />
            <p className="text-sm leading-relaxed text-muted-foreground">
              {siteConfig.description}
            </p>
            <div className="flex items-center gap-1">
              <Link
                href={siteConfig.links.github}
                aria-label="GitHub"
                className="rounded-lg p-2 text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <GitHubIcon className="size-4" />
              </Link>
              <Link
                href={siteConfig.links.twitter}
                aria-label="X"
                className="rounded-lg p-2 text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <XIcon className="size-4" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:gap-16">
            {FOOTER_GROUPS.map((group) => (
              <div key={group.title} className="space-y-3">
                <h3 className="text-xs font-semibold tracking-[0.12em] uppercase">{group.title}</h3>
                <ul className="space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          {/* Year is rendered server-side. Fine here: the footer is not cached
              across a year boundary in any deployment we run, and hydration sees
              the same string because the client never recomputes it. */}
          <span>
            © {new Date().getFullYear()} {siteConfig.name}. Built for people who deserve a callback.
          </span>
          <Link href={routes.home} className="transition-colors hover:text-foreground">
            {siteConfig.url.replace(/^https?:\/\//, "")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
