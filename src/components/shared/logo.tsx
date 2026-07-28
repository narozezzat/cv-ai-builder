import Link from "next/link";

import { routes } from "@/lib/routes";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Wordmark. Used by the marketing header, the app sidebar, and auth screens, so
 * it lives in the shared layer rather than in the marketing feature.
 *
 * The mark is inline SVG rather than an image file: it inherits `currentColor`,
 * so it works in both themes and on the print/OG surfaces without a second
 * asset, and it costs no network request.
 */

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="9" fill="url(#logo-gradient)" />
      {/* Abstracted document: three text lines with the last one "rewritten"
          shorter, echoing the product's bullet-tightening. */}
      <path
        d="M10 10.5h12M10 16h12M10 21.5h7"
        stroke="white"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="oklch(0.58 0.22 285)" />
          <stop offset="1" stopColor="oklch(0.56 0.24 330)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Logo({
  className,
  href = routes.home,
  showWordmark = true,
  wordmarkClassName,
}: {
  className?: string;
  href?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      <LogoMark className="transition-transform duration-300 group-hover:scale-105" />
      {showWordmark ? (
        <span className={cn("text-[1.0625rem] font-semibold tracking-tight", wordmarkClassName)}>
          {siteConfig.name}
        </span>
      ) : (
        <span className="sr-only">{siteConfig.name}</span>
      )}
    </Link>
  );
}
