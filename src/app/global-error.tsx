"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: catches errors thrown by the root layout itself.
 *
 * It replaces the root layout, which means the layout's `globals.css` import is
 * not in the tree — no Tailwind, no design tokens, no theme class. So everything
 * here is inline style and system font. Reaching for `cn()` or a `Button` would
 * render an unstyled skeleton at exactly the moment the user most needs the page
 * to look deliberate.
 *
 * It also has to supply its own `<html>` and `<body>`, and `<main id="main">` to
 * hold the skip-link contract even without the layout that defines the link.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0b0a12",
          color: "#f5f4f8",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <main id="main" style={{ maxWidth: "32rem", padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>
            The app failed to start
          </h1>
          <p style={{ color: "#a5a1b8", lineHeight: 1.6, marginTop: "0.75rem" }}>
            This is on our side, not yours. Reload to try again — nothing you saved has been lost.
          </p>
          {error.digest ? (
            <p
              style={{
                color: "#6f6b82",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "0.75rem",
                marginTop: "1rem",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.75rem",
              padding: "0.625rem 1.25rem",
              borderRadius: "0.625rem",
              border: "none",
              backgroundColor: "#7c5cff",
              color: "#ffffff",
              fontSize: "0.9375rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
