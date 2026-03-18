import { defineConfig } from "@playwright/test";

const isCI = Boolean(process.env.CI);

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
  webServer: {
    command: "pnpm --filter web start --hostname 127.0.0.1 --port 3000",
    port: 3000,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
