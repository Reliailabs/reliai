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
  await expect(page).toHaveURL(
    /\/operations\/incidents\/inc_123\?tab=investigation&project_id=proj_scope/,
  );

  await page.goto("/incidents/inc_123/compare?project_id=proj_scope");
  await expect(page).toHaveURL(
    /\/operations\/incidents\/inc_123\?tab=compare&project_id=proj_scope/,
  );
});

test("incident command compat redirect preserves project scope query", async ({ page }) => {
  await ensureSignedIn(page, "/incidents/inc_123/command?project_id=proj_scope");
  await expect(page).toHaveURL(/\/incidents\/inc_123\?project_id=proj_scope/);
});

test("operations project scope runtime probe preserves query continuity and accepts project_id timeline filter", async ({ page }) => {
  await ensureSignedIn(page, "/operations");

  const projectsResponse = await page.request.get("/api/v1/projects?limit=100");
  expect(projectsResponse.ok()).toBeTruthy();
  const projectsPayload = (await projectsResponse.json()) as { items?: Array<{ id: string }> };
  const projectId = projectsPayload.items?.[0]?.id ?? null;
  if (!projectId) {
    test.skip(true, "SKIPPED_OPS_SCOPE_PROBE: no projects available for scoped runtime probe.");
  }

  const timelineResponse = await page.request.get(
    `/api/v1/operations/timeline?project_id=${encodeURIComponent(projectId)}&limit=1`,
  );
  expect(timelineResponse.ok()).toBeTruthy();
  const timelinePayload = (await timelineResponse.json()) as { items?: Array<{ project_id: string | null }> };
  for (const item of timelinePayload.items ?? []) {
    expect(item.project_id === null || item.project_id === projectId).toBeTruthy();
  }

  await page.goto(`/operations?project_id=${encodeURIComponent(projectId)}`);
  await expect(page).toHaveURL(new RegExp(`/operations\\?project_id=${projectId}`));
});

test("operations detail and graph navigation preserve scoped project query", async ({ page }) => {
  await ensureSignedIn(page, "/operations");

  const projectsResponse = await page.request.get("/api/v1/projects?limit=100");
  expect(projectsResponse.ok()).toBeTruthy();
  const projectsPayload = (await projectsResponse.json()) as { items?: Array<{ id: string }> };
  const projectId = projectsPayload.items?.[0]?.id ?? null;
  if (!projectId) {
    test.skip(true, "SKIPPED_OPS_SCOPE_NAV: no projects available for scoped navigation probe.");
  }

  await page.goto(`/operations?project_id=${encodeURIComponent(projectId)}`);
  await expect(page).toHaveURL(new RegExp(`/operations\\?project_id=${projectId}`));

  const incidentLink = page.locator('a[href*="/operations/incidents/"]').first();
  if ((await incidentLink.count()) === 0) {
    test.skip(true, "SKIPPED_OPS_SCOPE_NAV: no operations incident links available for runtime probe.");
  }

  await incidentLink.click();
  await expect(page).toHaveURL(new RegExp(`/operations/incidents/.+\\?project_id=${projectId}`));

  const openGraphLink = page.getByRole("link", { name: "Open graph" });
  await openGraphLink.click();
  await expect(page).toHaveURL(new RegExp(`/operations/graph/.+\\?project_id=${projectId}`));

  await page.getByRole("link", { name: "Operations center" }).click();
  await expect(page).toHaveURL(new RegExp(`/operations\\?project_id=${projectId}`));
});
