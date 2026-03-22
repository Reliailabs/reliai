import { chromium } from "playwright";

const BASE_URL = process.env.RELIAI_BASE_URL ?? "http://localhost:3000";

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const results = [];
  const record = (label, ok, detail = "") => {
    results.push({ label, ok, detail });
    const status = ok ? "PASS" : "FAIL";
    console.log(`${status} | ${label}${detail ? ` | ${detail}` : ""}`);
  };

  try {
    await page.goto(`${BASE_URL}/traces`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const bannerVisible = await page.locator("text=Example trace").isVisible().catch(() => false);
    record("Example trace banner visible on /traces", bannerVisible);

    await page.waitForTimeout(1500);
    const url = page.url();
    const autoSelected = url.includes("/traces/") && !url.endsWith("/traces");
    record("Auto-selected trace navigation", autoSelected, `url=${url}`);

    if (!autoSelected) {
      await page.screenshot({ path: "/Users/robert/Documents/Reliai/test-results/trace-list.png", fullPage: true });
      record("Screenshot", true, "test-results/trace-list.png");
      await browser.close();
      return;
    }

    await page.waitForTimeout(1500);
    const hasRetrievalRequest = await page.locator("text=retrieval.request").first().isVisible().catch(() => false);
    record("retrieval.request visible", hasRetrievalRequest);

    const retrievalAttemptCount = await page.locator("text=retrieval.attempt").count();
    record("retrieval.attempt spans visible", retrievalAttemptCount >= 2, `count=${retrievalAttemptCount}`);

    const failureBlock = await page.locator("text=Retrieval Failure").isVisible().catch(() => false);
    record("Retrieval Failure block visible", failureBlock);

    const recoveredBlock = await page.locator("text=Recovered after retry").isVisible().catch(() => false);
    record("Recovered after retry block visible", recoveredBlock);

    await page.screenshot({ path: "/Users/robert/Documents/Reliai/test-results/trace-detail.png", fullPage: true });
    record("Screenshot", true, "test-results/trace-detail.png");
  } catch (error) {
    console.error("Trace check failed:", error);
    await page.screenshot({ path: "/Users/robert/Documents/Reliai/test-results/trace-error.png", fullPage: true }).catch(() => {});
    record("Screenshot", true, "test-results/trace-error.png");
  } finally {
    await browser.close();
  }
}

run();
