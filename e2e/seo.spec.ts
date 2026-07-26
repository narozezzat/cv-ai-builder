import { expect, test } from "@playwright/test";

/**
 * The SEO surface is generated code, so it breaks quietly — nothing in the UI
 * changes when `sitemap.xml` starts 500ing or the OG image route disappears.
 * These run once, on chromium only; they test HTTP responses, not rendering.
 */
test.describe("seo routes", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Response-level checks.");

  test("robots.txt advertises the sitemap and blocks private areas", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("Sitemap:");
    expect(body).toContain("/sitemap.xml");
    for (const blocked of ["/print/", "/dashboard", "/settings", "/api/"]) {
      expect(body).toContain(blocked);
    }
  });

  test("sitemap.xml is valid urlset xml", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");

    const body = await response.text();
    expect(body).toContain("<urlset");
    expect(body).toMatch(/<loc>https?:\/\/[^<]+<\/loc>/);
  });

  test("opengraph image renders as a 1200x630 png", async ({ request }) => {
    const response = await request.get("/opengraph-image");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    // A satori failure still returns 200 with an error body, so assert on size.
    expect((await response.body()).byteLength).toBeGreaterThan(5_000);
  });

  test("the landing page carries a parseable schema.org graph", async ({ page }) => {
    await page.goto("/");

    const raw = await page.locator('script[type="application/ld+json"]').first().innerHTML();
    const graph = JSON.parse(raw) as {
      "@context": string;
      "@graph": { "@type": string }[];
    };

    expect(graph["@context"]).toBe("https://schema.org");
    expect(graph["@graph"].map((node) => node["@type"])).toEqual(
      expect.arrayContaining(["Organization", "WebSite", "SoftwareApplication", "FAQPage"]),
    );
  });

  test("canonical, og, and twitter tags are present and absolute", async ({ page }) => {
    await page.goto("/");

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute("href", /^https?:\/\//);

    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /^https?:\/\//,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
  });

  test("unknown paths render the 404 page with a main landmark", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist");

    expect(response?.status()).toBe(404);
    await expect(page.locator("main#main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/couldn't find/i);
  });
});
