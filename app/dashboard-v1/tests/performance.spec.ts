import { test, expect, type Page } from "@playwright/test";

interface PerformanceMetrics {
  page: string;
  domContentLoaded: number;
  load: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
}

async function measurePagePerformance(page: Page, url: string): Promise<PerformanceMetrics> {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  
  const metrics = await page.evaluate(() => {
    const perf = performance as Performance & {
      getEntriesByType: (type: string) => Array<{ startTime: number; duration?: number; size?: number; value?: number }>;
    };
    
    const perfEntries = perf.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const paintEntries = perf.getEntriesByType("paint");
    const lcpEntries = perf.getEntriesByType("largest-contentful-paint");
    const clsEntries = perf.getEntriesByType("layout-shift");
    
    return {
      domContentLoaded: perfEntries.domContentLoadedEventStart,
      load: perfEntries.loadEventStart,
      firstContentfulPaint: paintEntries.find(e => e.name === "first-contentful-paint")?.startTime ?? 0,
      largestContentfulPaint: lcpEntries.length > 0 ? (lcpEntries[lcpEntries.length - 1] as any).startTime ?? 0 : 0,
      cumulativeLayoutShift: clsEntries.reduce((sum, entry: any) => sum + (entry.value ?? 0), 0),
    };
  });

  return {
    page: url,
    ...metrics,
  };
}

function formatMetric(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

function logMetrics(metrics: PerformanceMetrics): void {
  console.log(`\n📊 Performance Metrics for ${metrics.page}`);
  console.log(`   DOM Content Loaded: ${formatMetric(metrics.domContentLoaded)}`);
  console.log(`   Page Load: ${formatMetric(metrics.load)}`);
  console.log(`   First Contentful Paint: ${formatMetric(metrics.firstContentfulPaint)}`);
  console.log(`   Largest Contentful Paint: ${formatMetric(metrics.largestContentfulPaint)}`);
  console.log(`   Cumulative Layout Shift: ${metrics.cumulativeLayoutShift.toFixed(4)}`);
}

const PERFORMANCE_THRESHOLDS = {
  domContentLoaded: 2000,
  load: 4000,
  firstContentfulPaint: 1500,
  largestContentfulPaint: 4000,
  cumulativeLayoutShift: 0.1,
};

const routes = [
  { path: "/pulse", name: "Pulse" },
  { path: "/incidents", name: "Incidents" },
  { path: "/traces", name: "Traces" },
  { path: "/projects", name: "Projects" },
  { path: "/regressions", name: "Regressions" },
  { path: "/deployments", name: "Deployments" },
  { path: "/alerts", name: "Alerts" },
  { path: "/escalation", name: "Escalation" },
  { path: "/slos", name: "SLOs" },
  { path: "/intelligence", name: "Intelligence" },
  { path: "/eval-replay", name: "Eval Replay" },
  { path: "/prompt-diff", name: "Prompt Diff" },
  { path: "/settings", name: "Settings" },
];

for (const route of routes) {
  test(`performance: ${route.name} page load`, async ({ page }) => {
    const metrics = await measurePagePerformance(page, route.path);
    logMetrics(metrics);

    expect(metrics.domContentLoaded).toBeLessThan(PERFORMANCE_THRESHOLDS.domContentLoaded);
    expect(metrics.load).toBeLessThan(PERFORMANCE_THRESHOLDS.load);
    expect(metrics.firstContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint);
    expect(metrics.cumulativeLayoutShift).toBeLessThan(PERFORMANCE_THRESHOLDS.cumulativeLayoutShift);
  });
}

test.describe("Page navigation workflow", () => {
  test("dashboard → incidents → detail workflow", async ({ page }) => {
    const navigationMetrics: Array<{ from: string; to: string; duration: number }> = [];

    await page.goto("/pulse", { waitUntil: "networkidle" });
    
    const dashboardLoad = Date.now();
    navigationMetrics.push({ from: "start", to: "/pulse", duration: Date.now() - dashboardLoad });

    await page.click('a[href="/incidents"]');
    await page.waitForURL("**/incidents");
    const incidentsLoad = Date.now();
    navigationMetrics.push({ from: "/pulse", to: "/incidents", duration: Date.now() - incidentsLoad });

    const firstIncident = page.locator('a[href^="/incidents/"]').first();
    if (await firstIncident.count() > 0) {
      await firstIncident.click();
      await page.waitForURL("**/incidents/*");
      const detailLoad = Date.now();
      navigationMetrics.push({ from: "/incidents", to: "/incidents/[id]", duration: Date.now() - detailLoad });
    }

    console.log("\n🔗 Navigation Flow Performance:");
    navigationMetrics.forEach(nav => {
      console.log(`   ${nav.from} → ${nav.to}: ${nav.duration}ms`);
    });
  });
});
