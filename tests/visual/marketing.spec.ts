import { expect, test, type Page } from "@playwright/test";

const screenshotRoutes = [
  { name: "control-panel", route: "/marketing/screenshot/control-panel" },
  { name: "trace-graph", route: "/marketing/screenshot/trace-graph" },
  { name: "incident", route: "/marketing/screenshot/incident" },
  { name: "deployment", route: "/marketing/screenshot/deployment" },
  { name: "playground", route: "/marketing/screenshot/playground" },
] as const;

async function preparePage(page: Page, route: string) {
  await page.goto(route, { waitUntil: "networkidle" });
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
  );
  await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
      }
    `,
  });
  await page.waitForTimeout(500);
}

test.describe("marketing visual regressions", () => {
  test("homepage layout stable", async ({ page }) => {
    await preparePage(page, "/?visual=1");
    await expect(page).toHaveScreenshot("homepage.png", {
      animations: "disabled",
      caret: "hide",
      fullPage: true,
      timeout: 30_000,
    });
  });

  test("demo layout stable", async ({ page }) => {
    await preparePage(page, "/demo?visual=1");
    await expect(page).toHaveScreenshot("demo.png", {
      animations: "disabled",
      caret: "hide",
      fullPage: true,
      timeout: 30_000,
    });
  });

  test("playground layout stable", async ({ page }) => {
    await preparePage(page, "/playground?visual=1");
    await expect(page).toHaveScreenshot("playground-page.png", {
      animations: "disabled",
      caret: "hide",
      fullPage: true,
      timeout: 30_000,
    });
  });

  for (const shot of screenshotRoutes) {
    test(`${shot.name} screenshot stable`, async ({ page }) => {
      await preparePage(page, shot.route);

      await expect(page).toHaveScreenshot(`${shot.name}.png`, {
        animations: "disabled",
        caret: "hide",
        timeout: 30_000,
      });
    });
  }
});
