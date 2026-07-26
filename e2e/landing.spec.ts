import { expect, test } from "@playwright/test";

/**
 * Landing-page smoke suite.
 *
 * Deliberately asserts on roles, accessible names, and the `href` a CTA points
 * at rather than on copy or class names. Marketing text changes weekly; the
 * heading structure, the landmark, and where the buttons go are the contract.
 */
test.describe("landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders one h1 and the main landmark the skip link targets", async ({ page }) => {
    const h1 = page.getByRole("heading", { level: 1 });

    await expect(h1).toHaveCount(1);
    await expect(h1).toBeVisible();
    await expect(page.locator("main#main")).toBeVisible();
  });

  test("primary CTA points at signup", async ({ page }) => {
    const cta = page.getByRole("link", { name: /build my resume/i }).first();

    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/signup");
  });

  test("every landing section anchor exists", async ({ page }) => {
    // The header nav and the footer both link to these. A renamed `id` silently
    // turns those into no-ops, which no type check catches.
    for (const id of ["features", "how-it-works", "templates", "faq"]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
  });

  test("skip link points at the main landmark", async ({ page }) => {
    await expect(page.getByRole("link", { name: /skip to (main )?content/i })).toHaveAttribute(
      "href",
      "#main",
    );
  });

  test("skip link is the first thing Tab reaches", async ({ page, browserName }) => {
    // WebKit does not include links in the Tab order unless the OS-level
    // "press Tab to highlight each item" preference is on, so this specific
    // assertion is meaningless there. The href check above still runs everywhere.
    test.skip(browserName === "webkit", "WebKit excludes links from the Tab order.");

    await page.keyboard.press("Tab");

    await expect(page.getByRole("link", { name: /skip to (main )?content/i })).toBeFocused();
  });

  test("FAQ answers reveal on click", async ({ page }) => {
    const trigger = page.getByRole("button", { name: /applicant tracking system/i });

    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  test("theme toggle switches the document class", async ({ page }) => {
    const toDark = page.getByRole("button", { name: "Switch to dark theme" });

    await expect(toDark).toBeVisible();
    await toDark.click();

    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
  });

  test("images and iframes do not overflow the viewport horizontally", async ({ page }) => {
    // Cheap regression guard for the one layout bug that only shows on phones:
    // a section wider than the viewport, producing a horizontal scrollbar.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe("mobile navigation", () => {
  test("menu sheet opens and lists the section links", async ({ page, isMobile }) => {
    test.skip(!isMobile, "The sheet trigger is hidden at md and above.");

    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Features" })).toBeVisible();
  });
});
