import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

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
