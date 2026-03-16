import { expect, test } from "@playwright/test";

test.describe("marketing screenshot readiness", () => {
  test("control-panel screenshot route is fully rendered before capture", async ({ page }) => {
    await page.goto("/marketing/screenshot/control-panel", { waitUntil: "networkidle" });
    await page.waitForSelector("[data-control-panel-ready]");

    const skeletonCount = await page.evaluate(() => document.querySelectorAll("[data-skeleton]").length);
    expect(skeletonCount).toBe(0);

    await expect(page.getByText("Reliability score")).toBeVisible();
    await expect(page.getByText("Active incidents")).toBeVisible();
    await expect(page.getByText("Traces analyzed (24h)")).toBeVisible();
    await expect(page.locator("[data-control-panel]").getByText("traces/sec · 1m avg").first()).toBeVisible();
  });
});
