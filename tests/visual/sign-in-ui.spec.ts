import { test, expect } from "@playwright/test";

test("sign-in UI flow (dev fallback)", async ({ page }) => {
  await page.goto("/sign-in?return_to=/dashboard", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Operator sign-in" })).toBeVisible();
  await page.getByPlaceholder("owner@acme.test").fill("owner@acme.test");
  await page.getByPlaceholder("Password").fill("reliai-dev-password");
  await page.getByRole("button", { name: "Sign in with dev fallback" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
});
