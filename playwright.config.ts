import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);

/**
 * End-to-end suite. Runs against a production build rather than `next dev`:
 * dev-mode compilation makes the first navigation of every test slow enough to
 * cause flaky timeouts, and it is not the code that ships.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],
  // Skipped when PLAYWRIGHT_BASE_URL points at an already-running deployment
  // (preview URL, staging) — otherwise Playwright builds and boots the app.
  //
  // On CI the workflow runs `pnpm build` as its own step before this, so
  // rebuilding here would double the slowest part of the run for no signal.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: isCI ? "pnpm start" : "pnpm build && pnpm start",
        url: BASE_URL,
        reuseExistingServer: !isCI,
        timeout: 180_000,
      },
});
