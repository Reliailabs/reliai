import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const isCI = Boolean(process.env.CI);
const apiServerEnabled = process.env.PW_API_SERVER !== "false";
const repoRoot = path.resolve(__dirname, "../..");
const apiVenvPython = path.join(repoRoot, "apps/api/.venv/bin/python");
const apiPython = existsSync(apiVenvPython) ? apiVenvPython : "python";
const uvicornAvailable = apiServerEnabled
  ? spawnSync(apiPython, ["-c", "import uvicorn"], { stdio: "ignore" }).status === 0
  : false;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3005",
    viewport: { width: 1440, height: 900 },
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter pulse dev",
      port: 3005,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      cwd: repoRoot,
    },
    ...(uvicornAvailable
      ? [
          {
            command: `${apiPython} -m uvicorn app.main:app --host 127.0.0.1 --port 8000`,
            port: 8000,
            reuseExistingServer: !isCI,
            timeout: 120_000,
            cwd: path.join(repoRoot, "apps/api"),
          },
        ]
      : []),
  ],
});
