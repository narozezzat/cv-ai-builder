import "server-only";

/**
 * The browser half of the export pipeline: navigate to a print URL, wait until it is
 * genuinely finished, and hand back bytes.
 *
 * Why a real browser at all, when the templates are React and could be drawn to a canvas
 * or handed to a PDF library: because the preview *is* the template, rendered by Chromium.
 * Anything else is a second renderer, and a second renderer diverges — a heading that
 * wraps differently, a page break two lines off. Puppeteer means the file the user
 * downloads was produced by the same engine that drew what they approved, and it comes
 * with selectable text and real CSS pagination for free.
 *
 * SECURITY — this module opens a browser that fetches one of our own URLs. Two things keep
 * that from being a request-forgery primitive:
 *
 * 1. The URL is built here from `absoluteUrl(routes.print(token))`, never from caller
 *    input. Nothing in this file accepts a href.
 * 2. JavaScript is disabled in the page (`setJavaScriptEnabled(false)`). The print route
 *    is a static Server Component render, so it needs none — and the resume contains
 *    user-authored rich text, which we sanitize but would rather not also execute inside a
 *    process holding a session-less connection to our own origin.
 */

import type { Browser, Page } from "puppeteer-core";

import { requireServerEnv, serverEnv } from "@/lib/env/server";
import { routes } from "@/lib/routes";
import { absoluteUrl } from "@/lib/site";
import { PAGE_DIMENSIONS_MM } from "@/types/resume";
import type { ResumePage } from "@/types/resume";

/**
 * What this service can emit.
 *
 * Structurally the same union as the export feature's `ExportFormat`, and deliberately
 * declared again rather than imported: `services` sits below `features` in the dependency
 * direction, and a renderer that imports from the feature that calls it is the coupling the
 * boundary rule exists to prevent. The feature's value is assignable to this, so the two
 * are checked against each other at every call site.
 */
export type RenderFormat = "pdf" | "png" | "jpeg";

/** JPEG only, 0–1. Below ~0.9 the accent rules and small type start to fringe. */
const JPEG_QUALITY = 0.92;

/**
 * Selector the print page sets on the rendered document.
 *
 * Waiting on this rather than a timeout is the difference between "the render finished"
 * and "1500ms elapsed". `ResumeRenderer` writes `data-resume-page="print"` only when it
 * is given `printTarget`, so the attribute existing means the tree is in the DOM.
 */
const PRINT_TARGET_SELECTOR = '[data-resume-page="print"]';

/**
 * Ceiling on a single render.
 *
 * Generous because a cold serverless invocation pays for a Chromium unpack before it even
 * navigates, and a user who waits four seconds for a PDF is fine while a user who gets a
 * timeout at three is not. Any host running this needs a function timeout above it — see
 * `maxDuration` on the export route's action.
 */
const NAVIGATION_TIMEOUT_MS = 30_000;

export interface RenderResumeOptions {
  /** Signed print token. Becomes the URL path; never a full href. */
  token: string;
  format: RenderFormat;
  /** Page setup from the resume, so the PDF box matches what the editor showed. */
  page: ResumePage;
  /** `deviceScaleFactor` for the image formats. Ignored for PDF. */
  scale: number;
}

export interface RenderResumeResult {
  bytes: Uint8Array;
  /** Only known for PDF. Chromium does not report a page count for a screenshot. */
  pageCount: number | null;
}

/**
 * Renders one resume and returns the file bytes.
 *
 * The browser is closed in a `finally` — an un-closed Chromium is a leaked process on a
 * long-lived server and a leaked *invocation* on a serverless one, where the next request
 * inherits it and the memory it holds.
 */
export async function renderResume(options: RenderResumeOptions): Promise<RenderResumeResult> {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    await preparePage(page, options);

    return options.format === "pdf"
      ? await renderPdf(page, options.page)
      : await renderImage(page, options.format);
  } finally {
    await browser.close();
  }
}

/**
 * Points Puppeteer at a binary, in order of specificity.
 *
 * Three branches because the three environments genuinely differ. `CHROMIUM_EXECUTABLE_PATH`
 * wins so a host with its own browser never downloads a second one. Otherwise: on a
 * serverless platform `@sparticuz/chromium` unpacks a Brotli-compressed build into `/tmp`
 * and hands back the path — the only way to fit a browser inside a function bundle — while
 * locally the full `puppeteer` devDependency already has one in its cache.
 */
async function resolveExecutablePath(): Promise<string> {
  if (serverEnv.CHROMIUM_EXECUTABLE_PATH) {
    return serverEnv.CHROMIUM_EXECUTABLE_PATH;
  }

  if (isServerless()) {
    const chromium = (await import("@sparticuz/chromium")).default;

    return await chromium.executablePath();
  }

  // Dynamic import so the devDependency is never required on a serverless deploy, where it
  // is not installed. `serverExternalPackages` in `next.config.ts` keeps this resolvable.
  const puppeteer = (await import("puppeteer")).default;

  return puppeteer.executablePath();
}

/** `AWS_LAMBDA_FUNCTION_NAME` is set on Vercel functions and on Lambda itself. */
function isServerless(): boolean {
  return Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

async function launchBrowser(): Promise<Browser> {
  // Fail here, with a message naming the variable, rather than letting the print page 404
  // and reporting "render produced an empty file".
  requireServerEnv("EXPORT_TOKEN_SECRET");

  const puppeteer = await import("puppeteer-core");
  const executablePath = await resolveExecutablePath();

  return await puppeteer.launch({
    executablePath,
    args: await launchArgs(),
    // `"shell"` is chrome-headless-shell: smaller and faster to start, and it renders and
    // prints identically for a static page. It cannot do extensions or WebGL, neither of
    // which a resume uses.
    headless: "shell",
    // Chromium's default 800×600 would make an A4 page render at a viewport it never sees
    // in the editor; `preparePage` sets the real one per resume.
    defaultViewport: null,
  });
}

async function launchArgs(): Promise<string[]> {
  if (isServerless()) {
    // The sparticuz build ships the flag set its own filesystem and font layout needs.
    return (await import("@sparticuz/chromium")).default.args;
  }

  return [
    // Chromium's sandbox needs kernel namespaces that most container runtimes deny. We are
    // rendering our own trusted URL with JavaScript disabled, so the sandbox is buying very
    // little here — but this is the flag pair people cargo-cult, so: it is here to make
    // rendering work in a container, not because it is harmless.
    "--no-sandbox",
    "--disable-setuid-sandbox",
    // /dev/shm is 64MB in the default Docker configuration, which Chromium exhausts and
    // then crashes on mid-render.
    "--disable-dev-shm-usage",
  ];
}

async function preparePage(page: Page, options: RenderResumeOptions): Promise<void> {
  const { widthPx, heightPx } = viewportFor(options.page);

  await page.setJavaScriptEnabled(false);
  await page.setViewport({
    width: widthPx,
    height: heightPx,
    deviceScaleFactor: options.format === "pdf" ? 1 : options.scale,
  });

  const response = await page.goto(absoluteUrl(routes.print(options.token)), {
    // `networkidle0`, not `load`: web fonts and any avatar are subresources, and `load`
    // can fire with the text still laid out in a fallback face.
    waitUntil: "networkidle0",
    timeout: NAVIGATION_TIMEOUT_MS,
  });

  // A 404 here means the token was rejected or the resume vanished between minting and
  // navigating. Screenshotting the error page would produce a plausible-looking file.
  if (!response || !response.ok()) {
    throw new Error(`Print page returned ${response?.status() ?? "no response"}.`);
  }

  await page.waitForSelector(PRINT_TARGET_SELECTOR, { timeout: NAVIGATION_TIMEOUT_MS });

  // Belt and braces on the font race: `networkidle0` covers the requests, this covers the
  // moment between the last byte arriving and the face being usable for layout.
  await page.evaluate(() => document.fonts.ready);
}

/**
 * Viewport in CSS pixels, from the resume's own page setup.
 *
 * Width matters — it is what the layout measures against, and a narrower viewport changes
 * where text wraps, which changes where the page breaks. Height is one sheet; content past
 * it still paginates, because the renderer sets `minHeight` rather than `height`.
 */
function viewportFor(page: ResumePage): { widthPx: number; heightPx: number } {
  const { width, height } = PAGE_DIMENSIONS_MM[page.format];
  const MM_TO_PX = 96 / 25.4;

  return {
    widthPx: Math.round(width * MM_TO_PX),
    heightPx: Math.round(height * MM_TO_PX),
  };
}

async function renderPdf(page: Page, resumePage: ResumePage): Promise<RenderResumeResult> {
  const { width, height } = PAGE_DIMENSIONS_MM[resumePage.format];

  const bytes = await page.pdf({
    // Millimetres, matching the `@page` rule the renderer emits. Passing a named format
    // instead would work for A4 and Letter but silently ignore any future custom size.
    width: `${width}mm`,
    height: `${height}mm`,
    // Zero: the template owns its own margins, as padding on the page element. A Chromium
    // margin here would be added *on top* of that and shrink the content box.
    margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    // Without this Chromium drops every background — filled section bars, accent pills,
    // sidebar panels — and the PDF looks like a different template.
    printBackground: true,
    // The default header/footer is a URL and a date stamp on a document meant for an
    // employer. The renderer draws its own page numbers when the template asks for them.
    displayHeaderFooter: false,
    // CSS `@media print` is what `page-styles.ts` writes its rules for; emulating screen
    // here would discard the pagination control.
    preferCSSPageSize: false,
    timeout: NAVIGATION_TIMEOUT_MS,
  });

  return { bytes, pageCount: await countPdfPages(page, height) };
}

/**
 * Page count, derived from the rendered height rather than parsed out of the PDF.
 *
 * Measuring the document and dividing by the sheet height is exactly the arithmetic
 * Chromium does, and it avoids pulling in a PDF parser to read a number that is only ever
 * shown in the export history. Ceiling, and floored at 1: a resume is never zero pages.
 */
async function countPdfPages(page: Page, sheetHeightMm: number): Promise<number> {
  const contentHeightPx = await page.evaluate(() => {
    const target = document.querySelector('[data-resume-page="print"]');

    return target ? target.getBoundingClientRect().height : 0;
  });

  const sheetHeightPx = sheetHeightMm * (96 / 25.4);

  return Math.max(1, Math.ceil(contentHeightPx / sheetHeightPx));
}

/**
 * Screenshots the sheet.
 *
 * No scale parameter: a screenshot has no scale option of its own, so the requested DPI is
 * applied earlier as `deviceScaleFactor` on the viewport in `preparePage`.
 */
async function renderImage(
  page: Page,
  format: Exclude<RenderFormat, "pdf">,
): Promise<RenderResumeResult> {
  const element = await page.$(PRINT_TARGET_SELECTOR);

  if (!element) {
    throw new Error("Print target disappeared before the screenshot.");
  }

  // An element screenshot, not a full-page one: it crops to the sheet exactly, so a
  // one-and-a-bit-page resume does not come back as an image with a band of empty white.
  const bytes = await element.screenshot({
    type: format,
    // Undefined for PNG — Puppeteer rejects `quality` on a lossless format rather than
    // ignoring it.
    ...(format === "jpeg" ? { quality: Math.round(JPEG_QUALITY * 100) } : {}),
    captureBeyondViewport: false,
  });

  return { bytes, pageCount: null };
}

export { PRINT_TARGET_SELECTOR };
