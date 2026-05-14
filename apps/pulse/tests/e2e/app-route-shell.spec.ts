import { expect, test } from "@playwright/test";

const DEV_EMAIL = process.env.PW_E2E_EMAIL ?? "";
const DEV_PASSWORD = process.env.PW_E2E_PASSWORD ?? "";
const AUTH_E2E_ENABLED = DEV_EMAIL.length > 0 && DEV_PASSWORD.length > 0;
const REQUIRE_AUTH_E2E = process.env.CI === "true" || process.env.PW_REQUIRE_AUTH_E2E === "1";

if (REQUIRE_AUTH_E2E && !AUTH_E2E_ENABLED) {
  throw new Error(
    "SKIPPED_AUTH_E2E_BLOCKED: PW_E2E_EMAIL and PW_E2E_PASSWORD are required when CI=true or PW_REQUIRE_AUTH_E2E=1.",
  );
}

async function ensureSignedIn(page: import("@playwright/test").Page, targetPath: string) {
  await page.goto(targetPath);
  if (page.url().includes("/sign-in")) {
    if (!AUTH_E2E_ENABLED) {
      test.skip(true, "SKIPPED_AUTH_E2E: set PW_E2E_EMAIL and PW_E2E_PASSWORD.");
    }
    await page.locator('input[name="email"]').fill(DEV_EMAIL);
    await page.locator('input[name="password"]').fill(DEV_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).not.toHaveURL(/\/sign-in/);
  }
}

test("authenticated /onboarding renders inside shared shell", async ({ page }) => {
  await ensureSignedIn(page, "/onboarding?path=sdk");
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByText("Reliai").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
});

test("authenticated /pulse/system renders inside shared shell", async ({ page }) => {
  await ensureSignedIn(page, "/pulse/system");
  await expect(page).toHaveURL(/\/pulse\/system/);
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("System").first()).toBeVisible();
});

test("sidebar route transitions avoid hydration/runtime errors", async ({ page }) => {
  const issues: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" || /hydration|did not match|runtime error/i.test(text)) {
      issues.push(text);
    }
  });
  page.on("pageerror", (err) => issues.push(String(err)));

  await ensureSignedIn(page, "/pulse");
  await page.getByRole("link", { name: "Onboarding" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings/);
  await page.getByRole("button", { name: "Pulse" }).click();
  await expect(page).toHaveURL(/\/pulse/);

  const filtered = issues.filter((issue) => !/favicon|Failed to load resource/i.test(issue));
  expect(filtered).toEqual([]);
});

test.describe("mobile shell smoke", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("shell/nav remains usable on /onboarding and /pulse/system", async ({ page }) => {
    await ensureSignedIn(page, "/onboarding");
    await expect(page.getByText("Reliai").first()).toBeVisible();

    await page.goto("/pulse/system");
    await expect(page.getByText("System").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  });
});

test("anonymous route redirect smoke keeps return_to semantics", async ({ page }) => {
  await page.goto("/onboarding?path=simulation&autostart=1");
  await expect(page).toHaveURL(/\/sign-in\?return_to=%2Fonboarding%3Fpath%3Dsimulation%26autostart%3D1/);
  await page.goto("/system");
  await expect(page).toHaveURL(/\/sign-in\?return_to=%2Fsystem/);
});
