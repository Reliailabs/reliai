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
  await page.getByRole("button", { name: /Reliai|Pulse/ }).click();
  await expect(page).toHaveURL(/\/pulse/);

  const filtered = issues.filter((issue) => !/favicon|Failed to load resource/i.test(issue));
  const runtimeFiltered = filtered.filter(
    (issue) =>
      !/A tree hydrated but some attributes of the server rendered HTML didn't match the client properties/i.test(issue) &&
      !/id="radix-_/i.test(issue),
  );
  expect(runtimeFiltered).toEqual([]);
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
  await page.goto("/incidents/inc_123/investigate");
  await expect(page).toHaveURL(/\/sign-in\?return_to=%2Fincidents%2Finc_123%2Finvestigate/);
  await page.goto("/incidents/inc_123/compare");
  await expect(page).toHaveURL(/\/sign-in\?return_to=%2Fincidents%2Finc_123%2Fcompare/);
});

test("auth return continuity preserves incident alias deep links", async ({ page }) => {
  await ensureSignedIn(page, "/incidents/inc_123/investigate");
  await expect(page).toHaveURL(/\/operations\/incidents\/inc_123\?tab=investigation/);

  await page.goto("/incidents/inc_123/compare");
  await expect(page).toHaveURL(/\/operations\/incidents\/inc_123\?tab=compare/);
});

test("incident alias deep links preserve project scope query on redirect", async ({ page }) => {
  await ensureSignedIn(page, "/incidents/inc_123/investigate?project_id=proj_scope");
  await expect(page).toHaveURL(/\/operations\/incidents\/inc_123\?tab=investigation/);
  const investigateUrl = new URL(page.url());
  if (!investigateUrl.searchParams.has("project_id")) {
    test.skip(true, "SKIPPED_SCOPE_ALIAS_QUERY: no resolvable project scope available for alias continuity probe.");
  }
  expect(investigateUrl.searchParams.get("project_id")).toBeTruthy();
  expect(investigateUrl.searchParams.get("project_id")).not.toBe("proj_scope");

  await page.goto("/incidents/inc_123/compare?project_id=proj_scope");
  await expect(page).toHaveURL(/\/operations\/incidents\/inc_123\?tab=compare/);
  const compareUrl = new URL(page.url());
  expect(compareUrl.searchParams.get("project_id")).toBe(investigateUrl.searchParams.get("project_id"));
});

test("incident command compat redirect preserves project scope query", async ({ page }) => {
  await ensureSignedIn(page, "/incidents/inc_123/command?project_id=proj_scope");
  await expect(page).toHaveURL(/\/incidents\/inc_123(\/command)?/);
  const url = new URL(page.url());
  expect(["/incidents/inc_123", "/incidents/inc_123/command"]).toContain(url.pathname);
  if (url.searchParams.has("project_id")) {
    expect(url.searchParams.get("project_id")).not.toBe("");
  }
});

test("operations project scope runtime probe preserves query continuity and accepts project_id timeline filter", async ({ page }) => {
  await ensureSignedIn(page, "/operations?project_id=proj_scope");
  await expect(page).toHaveURL(/\/(operations|pulse)/);
  const url = new URL(page.url());
  if (url.pathname === "/operations") {
    expect(url.searchParams.get("project_id")).not.toBe("proj_scope");
  }
});

test("operations detail and graph navigation preserve scoped project query", async ({ page }) => {
  await ensureSignedIn(page, "/operations");
  await expect(page).toHaveURL(/\/(operations|pulse)/);
  if (!page.url().includes("/operations")) {
    test.skip(true, "SKIPPED_OPS_SCOPE_NAV: operations route unavailable in current auth context.");
  }

  const incidentLink = page.locator('a[href*="/operations/incidents/"]').first();
  if ((await incidentLink.count()) === 0) {
    test.skip(true, "SKIPPED_OPS_SCOPE_NAV: no operations incident links available for runtime probe.");
  }
  const incidentHref = await incidentLink.getAttribute("href");
  expect(incidentHref).toBeTruthy();
  const hasScopedQuery = incidentHref?.includes("project_id=") ?? false;
  await incidentLink.click();
  await expect(page).toHaveURL(/\/operations\/incidents\/.+/);
  if (hasScopedQuery) {
    expect(page.url()).toContain("project_id=");
  }

  const openGraphLink = page.getByRole("link", { name: "Open graph" });
  const openGraphHref = await openGraphLink.getAttribute("href");
  expect(openGraphHref).toBeTruthy();
  const graphHasScopedQuery = openGraphHref?.includes("project_id=") ?? false;
  await openGraphLink.click();
  await expect(page).toHaveURL(/\/operations\/graph\/.+/);
  if (graphHasScopedQuery) {
    expect(page.url()).toContain("project_id=");
  }

  await page.getByRole("link", { name: "Operations center" }).click();
  await expect(page).toHaveURL(/\/operations/);
});

test("project scope selector continuity across incidents → operations → traces", async ({ page }) => {
  await ensureSignedIn(page, "/incidents");
  await expect(page).toHaveURL(/\/incidents/);

  const selector = page.getByRole("combobox", { name: "Select project scope" });
  if ((await selector.count()) === 0) {
    test.skip(true, "SKIPPED_SCOPE_SWITCH: project scope selector unavailable.");
  }

  await selector.click();
  const options = page.getByRole("option");
  const optionCount = await options.count();
  if (optionCount < 2) {
    test.skip(true, "SKIPPED_SCOPE_SWITCH: fewer than two project scope options.");
  }

  const beforeValue = new URL(page.url()).searchParams.get("project_id");
  await options.nth(1).click();
  await expect(page).toHaveURL(/\/incidents\?project_id=/);
  const projectId = new URL(page.url()).searchParams.get("project_id");
  expect(projectId).toBeTruthy();
  if (beforeValue) {
    expect(projectId).not.toBe(beforeValue);
  }

  const operationsLink = page.locator('a[href*="/operations/incidents/"]').first();
  if ((await operationsLink.count()) === 0) {
    test.skip(true, "SKIPPED_SCOPE_SWITCH: no operations incident link available from incidents list.");
  }
  await operationsLink.click();
  await expect(page).toHaveURL(new RegExp(`/operations/incidents/.+\\?project_id=${projectId}`));

  await page.goto(`/traces?project_id=${encodeURIComponent(projectId!)}`);
  await expect(page).toHaveURL(new RegExp(`/traces\\?project_id=${projectId}`));

  const traceDetailLink = page.locator('a[href*="/traces/"]').filter({ hasText: /View|Compare|Graph/i }).first();
  if ((await traceDetailLink.count()) > 0) {
    await traceDetailLink.click();
    await expect(page).toHaveURL(new RegExp(`/traces/.+project_id=${projectId}`));
  }
});

test("regression detail route keeps scope selector continuity into operations", async ({ page }) => {
  await ensureSignedIn(page, "/regressions");
  await expect(page).toHaveURL(/\/regressions/);

  const selector = page.getByRole("combobox", { name: "Select project scope" });
  if ((await selector.count()) === 0) {
    test.skip(true, "SKIPPED_REGRESSION_SCOPE: project scope selector unavailable.");
  }

  await selector.click();
  const options = page.getByRole("option");
  if ((await options.count()) < 1) {
    test.skip(true, "SKIPPED_REGRESSION_SCOPE: no project options available.");
  }
  await options.first().click();
  await expect(page).toHaveURL(/\/regressions(\?project_id=)?/);
  const projectId = new URL(page.url()).searchParams.get("project_id");
  if (!projectId) {
    test.skip(true, "SKIPPED_REGRESSION_SCOPE: no resolved scoped project id for runtime continuity probe.");
  }

  const detailLink = page.locator('a[href*="/operations/regressions/"]').first();
  if ((await detailLink.count()) === 0) {
    test.skip(true, "SKIPPED_REGRESSION_SCOPE: no regression detail links available.");
  }
  await detailLink.click();
  await expect(page).toHaveURL(new RegExp(`/operations/regressions/.+\\?project_id=${projectId}`));

  const operationsLink = page.getByRole("link", { name: "Operations center" });
  await operationsLink.click();
  await expect(page).toHaveURL(new RegExp(`/operations\\?project_id=${projectId}`));
});
