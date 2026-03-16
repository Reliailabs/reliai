import { expect, test } from "@playwright/test";

async function prepareMarketingPage(
  page: import("@playwright/test").Page,
  route: string,
  readySelector: string,
) {
  await page.goto(route, { waitUntil: "networkidle" });
  await page.waitForSelector(readySelector);
}

test.describe("marketing layout checks", () => {
  test("homepage has no horizontal overflow and keeps the expected container rail", async ({ page }) => {
    await prepareMarketingPage(page, "/?visual=1", "[data-marketing-container]");

    const overflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);

    const width = await page.evaluate(() => {
      const el = document.querySelector("[data-marketing-container]");
      return el?.getBoundingClientRect().width ?? 0;
    });

    expect(width).toBeGreaterThan(1100);
    expect(width).toBeLessThan(1220);
  });

  test("control-panel screenshot route exposes the panel surface", async ({ page }) => {
    await prepareMarketingPage(page, "/marketing/screenshot/control-panel", "[data-control-panel-ready]");

    const panel = page.locator("[data-control-panel]");
    await expect(panel).toBeVisible();
  });
});
