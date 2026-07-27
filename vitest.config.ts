import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Reads `.env.local` into a plain record.
 *
 * Hand-rolled rather than `dotenv` (not a dependency) or Vite's `loadEnv` (comes
 * from `vite`, which is only a transitive dependency of Vitest — importing it
 * directly relies on a package we never declared). The file only ever holds
 * `KEY=value` lines, so a parser that handles comments, blanks, and surrounding
 * quotes covers it. Returns `{}` when the file is absent, which is the CI case.
 */
function readEnvLocal(): Record<string, string> {
  let contents: string;

  try {
    contents = readFileSync(resolve(import.meta.dirname, ".env.local"), "utf8");
  } catch {
    return {};
  }

  const env: Record<string, string> = {};

  for (const line of contents.split("\n")) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*)\s*$/.exec(line);

    if (!match || line.trimStart().startsWith("#")) continue;

    env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }

  return env;
}

/**
 * Unit and component tests. Playwright owns anything that needs a real browser
 * or a running server, so `e2e/` is excluded here to keep the two suites from
 * collecting each other's files.
 */
export default defineConfig({
  plugins: [react()],
  // `@/*` comes straight from tsconfig — Vite resolves those natively now, so no
  // paths plugin and no second copy of the alias map to keep in step.
  resolve: { tsconfigPaths: true },
  test: {
    /**
     * `.env.local` reaches the tests that need it.
     *
     * Vitest does not read dotenv files on its own, and the RLS isolation test is
     * an integration test: it needs the project URL and both keys to talk to a
     * real Supabase project. Tests that find the keys absent skip themselves,
     * which is what CI does — the guarantee is proven locally against a real
     * server, because there is no way to prove a Postgres policy without a
     * Postgres.
     */
    env: readEnvLocal(),
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/components/ui/**", // vendored shadcn primitives
        "src/types/**",
        "src/**/index.ts",
      ],
    },
  },
});
