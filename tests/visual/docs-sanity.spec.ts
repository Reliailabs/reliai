import { expect, test, type Locator } from "@playwright/test";

async function yPosition(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) return null;
  return box.y;
}

async function expectInOrder(...locators: Locator[]) {
  const positions = await Promise.all(locators.map(async (loc) => yPosition(loc)));
  for (let i = 1; i < positions.length; i += 1) {
    if (positions[i - 1] === null || positions[i] === null) {
      throw new Error("One or more elements are not visible on the page.");
    }
    if (positions[i - 1]! > positions[i]!) {
      throw new Error("Elements are not in the expected order.");
    }
  }
}

test("docs sanity: landing, getting started, system guide, example CTA", async ({ page }) => {
  await page.goto("/docs", { waitUntil: "networkidle" });
  await expect(page.getByText("Connect your system", { exact: false })).toBeVisible();

  await page.goto("/docs/examples/copilot", { waitUntil: "networkidle" });
  await expect(page.locator('a[href="/docs/getting-started/copilot"]')).toBeVisible();

  await page.goto("/docs/getting-started", { waitUntil: "networkidle" });
  await expect(page.getByText("Node SDK (recommended)", { exact: false })).toBeVisible();
  await expect(page.getByText("Raw HTTP", { exact: false })).toBeVisible();

  await page.goto("/docs/getting-started/rag", { waitUntil: "networkidle" });
  const whatToSend = page.getByText("What to send", { exact: false }).first();
  const sdkHeading = page.getByText("Node SDK (recommended)", { exact: false }).first();
  const httpHeading = page.getByText("Raw HTTP", { exact: false }).first();
  const detectHeading = page.getByText("What Reliai will detect", { exact: false }).first();
  const exampleHeading = page.getByText("See an example", { exact: false }).first();

  await Promise.all([
    expect(whatToSend).toBeVisible(),
    expect(sdkHeading).toBeVisible(),
    expect(httpHeading).toBeVisible(),
    expect(detectHeading).toBeVisible(),
    expect(exampleHeading).toBeVisible(),
  ]);

  await expectInOrder(whatToSend, sdkHeading, httpHeading, detectHeading, exampleHeading);
});
