import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import process from "node:process";

import { chromium } from "@playwright/test";

const root = process.cwd();
const outputDir = path.join(root, "apps/web/public/screenshots");
const baseUrl = "http://127.0.0.1:3000";
const viewport = {
  width: 1600,
  height: 1000,
} as const;

const shots = [
  {
    route: "/marketing/screenshot/control-panel",
    file: "control-panel.png",
    signals: ["text=Reliability score", "text=Active incidents", "text=Operator guidance"],
    scrollY: 160,
  },
  {
    route: "/marketing/screenshot/trace-graph",
    file: "trace-graph.png",
    signals: ["text=Trace Analysis", "text=Slowest step", "text=Largest token consumer"],
    scrollY: 120,
  },
  {
    route: "/marketing/screenshot/incident",
    file: "incident.png",
    signals: ["text=Likely root cause", "text=Recommended mitigation"],
    scrollY: 80,
  },
  {
    route: "/marketing/screenshot/deployment",
    file: "deployment.png",
    signals: ["text=Deployment safety check", "text=Deployment risk factors"],
    scrollY: 120,
  },
];

async function isReady(url: string) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitFor(url: string, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isReady(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startWebServer() {
  return spawn("pnpm", ["--filter", "web", "dev", "--port", "3000"], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: "3000",
    },
  });
}

async function captureShot(
  page: import("@playwright/test").Page,
  shot: (typeof shots)[number],
) {
  const url = `${baseUrl}${shot.route}`;
  await page.goto(url, { waitUntil: "networkidle" });

  for (const signal of shot.signals) {
    await page.waitForSelector(signal);
  }

  await page.evaluate((scrollY) => {
    window.scrollTo({ top: scrollY, left: 0, behavior: "instant" });
  }, shot.scrollY);
  await page.waitForTimeout(250);

  await page.screenshot({
    path: path.join(outputDir, shot.file),
    type: "png",
  });
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  let child: ChildProcess | null = null;
  const healthRoute = `${baseUrl}${shots[0].route}`;
  if (!(await isReady(healthRoute))) {
    child = startWebServer();
    await waitFor(healthRoute);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: 2,
  });

  try {
    for (const shot of shots) {
      await captureShot(page, shot);
      const outputPath = path.join(outputDir, shot.file);
      if (!existsSync(outputPath)) {
        throw new Error(`Expected screenshot was not written: ${outputPath}`);
      }
    }
  } finally {
    await browser.close();
    if (child) {
      child.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
