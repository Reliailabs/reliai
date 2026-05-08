import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  snapshotPathTemplate: "{testDir}/__snapshots__/{arg}{ext}",
  fullyParallel: true,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3002",
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 2,
    trace: "on-first-retry",
    actionTimeout: 10000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
  webServer: {
    command: "pnpm --filter web-v2 dev --port 3002",
    port: 3002,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  timeout: 30000,
});
