import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Keep the browser automation packages out of the bundler.
   *
   * `puppeteer-core` and `@sparticuz/chromium` resolve native binaries and a Brotli
   * archive at runtime, both by filesystem path. Bundled, those paths point into
   * `.next/server` where nothing was copied, and the failure surfaces as a missing
   * Chromium rather than a build error. Listing them here makes Next `require()` them
   * from `node_modules` instead.
   *
   * `puppeteer` is a devDependency and only reached through a dynamic import in the
   * local branch of `services/render/chromium.ts`, but it is listed for the same reason:
   * the bundler follows that import while tracing.
   */
  serverExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium"],
};

export default nextConfig;
