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
    readySelector: "[data-control-panel-ready]",
    elementSelector: "[data-control-panel]",
    scrollY: 0,
  },
  {
    route: "/marketing/screenshot/incident",
    file: "incident.png",
    signals: ["text=Root cause", "text=Impact"],
    readySelector: "[data-incident-command-center-ready]",
    elementSelector: "[data-incident-command-center]",
    scrollY: 0,
  },
  {
    route: "/marketing/screenshot/trace-graph",
    file: "trace-graph.png",
    signals: ["text=Execution graph", "text=Execution breakdown", "text=Slowest span"],
    readySelector: "[data-trace-graph-ready]",
    elementSelector: "[data-trace-graph]",
    scrollY: 0,
  },
];

const onlyShots = (process.env.SCREENSHOTS_ONLY ?? process.env.SCREENSHOT_ONLY ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const selectedShots = onlyShots.length
  ? shots.filter((shot) => onlyShots.includes(shot.file))
  : shots;

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
  return spawn(
    "pnpm",
    ["--filter", "web", "start", "--hostname", "127.0.0.1", "--port", "3000"],
    {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: "3000",
    },
    },
  );
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

  if ("readySelector" in shot && shot.readySelector) {
    await page.waitForSelector(shot.readySelector);
  }

  await page.evaluate(({ scrollY }) => {
    document.documentElement.style.zoom = "1";
    document.body.style.zoom = "1";
    window.scrollTo({ top: scrollY, left: 0, behavior: "instant" });
  }, { scrollY: shot.scrollY });
  await page.waitForTimeout(250);

  const outputPath = path.join(outputDir, shot.file);

  if ("elementSelector" in shot && shot.elementSelector) {
    const panel = page.locator(shot.elementSelector).first();
    if (await panel.count()) {
      const box = await panel.boundingBox();
      if (box && box.width > 0 && box.height > 0) {
        await panel.screenshot({
          path: outputPath,
          type: "png",
        });
        return;
      }
    }
  }

  await page.screenshot({
    path: outputPath,
    type: "png",
  });
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  let child: ChildProcess | null = null;
  const healthRoute = `${baseUrl}${selectedShots[0].route}`;
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
    for (const shot of selectedShots) {
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
