import { expect, test, type Page } from "@playwright/test";

const screenshotRoutes = [
  {
    name: "control-panel",
    route: "/marketing/screenshot/control-panel",
    readySelector: "[data-control-panel-ready]",
    containerSelector: "[data-control-panel]",
  },
  {
    name: "trace-graph",
    route: "/marketing/screenshot/trace-graph",
    readySelector: "[data-trace-graph-ready]",
    containerSelector: "[data-trace-graph]",
  },
  {
    name: "incident",
    route: "/marketing/screenshot/incident",
    readySelector: "[data-incident-command-center-ready]",
    containerSelector: "[data-incident-command-center]",
  },
  {
    name: "deployment",
    route: "/marketing/screenshot/deployment",
    readySelector: "[data-deployment-detail-ready]",
    containerSelector: "[data-deployment-detail]",
  },
  {
    name: "playground",
    route: "/marketing/screenshot/playground",
    readySelector: "[data-playground-container-ready]",
    containerSelector: "[data-playground-container]",
  },
] as const;

async function preparePage(page: Page, route: string, readySelector?: string) {
  await page.addInitScript(() => {
    Date.now = () => 1_700_000_000_000;
  });
  await page.goto(route, { waitUntil: "networkidle" });
  await page.waitForLoadState("networkidle");
  if (readySelector) {
    await page.waitForSelector(readySelector, { state: "visible" });
  }
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
    await preparePage(page, "/?visual=1", "[data-marketing-container]");
    const container = page.locator("[data-marketing-container]");
    await expect(container).toHaveScreenshot("homepage.png", {
      animations: "disabled",
      caret: "hide",
      fullPage: false,
      timeout: 30_000,
    });
  });

  test("demo layout stable", async ({ page }) => {
    await preparePage(page, "/demo?visual=1", "[data-demo-container-ready]");
    const container = page.locator("[data-demo-container]").first();
    await expect(container).toHaveScreenshot("demo.png", {
      animations: "disabled",
      caret: "hide",
      fullPage: false,
      timeout: 30_000,
    });
  });

  test("playground layout stable", async ({ page }) => {
    await preparePage(page, "/playground?visual=1", "[data-playground-container-ready]");
    const container = page.locator("[data-playground-container]").first();
    await expect(container).toHaveScreenshot("playground-page.png", {
      animations: "disabled",
      caret: "hide",
      fullPage: false,
      timeout: 30_000,
    });
  });

  for (const shot of screenshotRoutes) {
    test(`${shot.name} screenshot stable`, async ({ page }) => {
      await preparePage(page, shot.route, shot.readySelector);

      const container = page.locator(shot.containerSelector ?? "main").first();
      await expect(container).toHaveScreenshot(`${shot.name}.png`, {
        animations: "disabled",
        caret: "hide",
        timeout: 30_000,
      });
    });
  }
});
