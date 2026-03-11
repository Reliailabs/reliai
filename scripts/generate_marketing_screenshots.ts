import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import process from "node:process";

import { chromium } from "@playwright/test";

const root = process.cwd();
const outputDir = path.join(root, "apps/web/public/screenshots");
const baseUrl = "http://127.0.0.1:3000";

const shots = [
  { route: "/marketing/screenshot/control-panel", file: "control-panel.png" },
  { route: "/marketing/screenshot/incident", file: "incident.png" },
  { route: "/marketing/screenshot/trace-graph", file: "trace-graph.png" },
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
    viewport: {
      width: 3200,
      height: 2000,
    },
    deviceScaleFactor: 1,
  });

  try {
    for (const shot of shots) {
      const url = `${baseUrl}${shot.route}`;
      await page.goto(url, { waitUntil: "networkidle" });
      await page.screenshot({
        path: path.join(outputDir, shot.file),
        type: "png",
      });
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
