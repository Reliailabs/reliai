import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";

const isCI = Boolean(process.env.CI);
const apiServerEnabled = process.env.PW_API_SERVER !== "false";
const venvPython = path.join(process.cwd(), "apps/api/.venv/bin/python");
const apiPython = existsSync(venvPython) ? venvPython : "python";

export default defineConfig({
  testDir: "./tests/visual",
  snapshotPathTemplate: "{testDir}/__snapshots__/{arg}{ext}",
  fullyParallel: false,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 2,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter web dev --port 3000",
      port: 3000,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    ...(apiServerEnabled
      ? [
          {
            command: `${apiPython} -m uvicorn app.main:app --host 127.0.0.1 --port 8000`,
            port: 8000,
            reuseExistingServer: !isCI,
            timeout: 120_000,
            cwd: "apps/api",
          },
        ]
      : []),
  ],
});
