import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { siteConfig, SITE_URL } from "@/lib/site";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Root metadata. `metadataBase` is what lets every nested route express its
 * canonical and OG URLs as relative paths — without it Next emits relative
 * `og:url` values, which crawlers and link unfurlers reject.
 *
 * `title.template` means child routes set only their own segment.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.author, url: siteConfig.url }],
  creator: siteConfig.author,
  applicationName: siteConfig.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} — ${siteConfig.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  formatDetection: { telephone: false, address: false, email: false },
};

/**
 * `themeColor` is theme-aware so mobile browser chrome matches the page instead
 * of flashing a light bar over a dark app. `maximumScale` is deliberately left
 * at the default: locking zoom fails WCAG 1.4.4.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "oklch(0.995 0.002 285)" },
    { media: "(prefers-color-scheme: dark)", color: "oklch(0.155 0.012 280)" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `suppressHydrationWarning` is required by next-themes: it writes the theme
    // class onto <html> before React hydrates, so server and client markup
    // legitimately differ on this one element.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          {/*
            One tooltip provider at the root rather than per-feature. Base UI
            uses it to share open/close timing across triggers, so pointing
            through a row of icon buttons shows each tooltip instantly instead
            of re-waiting the open delay on every one.
          */}
          <TooltipProvider delay={280} closeDelay={80}>
            {/* Skip link: first focusable element, visible only when focused. */}
            <a
              href="#main"
              className="sr-only rounded-md bg-background px-4 py-2 font-medium text-foreground ring-ring focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:ring-2"
            >
              Skip to content
            </a>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
