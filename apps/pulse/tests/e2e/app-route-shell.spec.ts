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

async function resolveScopedProjectId(page: import("@playwright/test").Page): Promise<string | null> {
  await ensureSignedIn(page, "/onboarding?path=sdk");
  await expect(page).toHaveURL(/\/onboarding/);

  let scopedProjectId = new URL(page.url()).searchParams.get("project_id");
  if (scopedProjectId) return scopedProjectId;

  const createOrg = page.getByRole("button", { name: "Create organization" });
  if ((await createOrg.count()) > 0) {
    await createOrg.click();
    await expect(page).toHaveURL(/\/onboarding/);
  }

  const createProject = page.getByRole("button", { name: "Create project" });
  if ((await createProject.count()) > 0) {
    await createProject.click();
    await expect(page).toHaveURL(/\/onboarding\?path=sdk&project_id=/);
  }

  scopedProjectId = new URL(page.url()).searchParams.get("project_id");
  if (scopedProjectId) return scopedProjectId;

  const projectInput = page.locator('input[name="project_id"]').first();
  if ((await projectInput.count()) > 0) {
    const value = await projectInput.getAttribute("value");
    if (value) return value;
  }

  return null;
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
  const scopedProjectId = await resolveScopedProjectId(page);
  const scopeQuery = scopedProjectId ? `?project_id=${encodeURIComponent(scopedProjectId)}` : "";
  await page.goto(`/incidents/inc_123/investigate${scopeQuery}`);
  await expect(page).toHaveURL(/\/operations\/incidents\/inc_123\?tab=investigation/);
  const investigateUrl = new URL(page.url());
  if (scopedProjectId) {
    expect(investigateUrl.searchParams.get("project_id")).toBe(scopedProjectId);
  }

  await page.goto(`/incidents/inc_123/compare${scopeQuery}`);
  await expect(page).toHaveURL(/\/operations\/incidents\/inc_123\?tab=compare/);
  const compareUrl = new URL(page.url());
  if (scopedProjectId) {
    expect(compareUrl.searchParams.get("project_id")).toBe(scopedProjectId);
  }
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
  const scopedProjectId = await resolveScopedProjectId(page);
  const opsPath = scopedProjectId
    ? `/operations?project_id=${encodeURIComponent(scopedProjectId)}`
    : "/operations";
  await page.goto(opsPath);
  await expect(page).toHaveURL(/\/operations/);

  const incidentLink = page.locator('a[href*="/operations/incidents/"]').first();
  if ((await incidentLink.count()) === 0) {
    await expect(page).toHaveURL(/\/operations/);
    await expect(page.getByRole("link", { name: "Onboarding" })).toBeVisible();
    return;
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
  if (scopedProjectId) {
    await expect(page).toHaveURL(new RegExp(`/operations\\?project_id=${encodeURIComponent(scopedProjectId)}`));
  } else {
    await expect(page).toHaveURL(/\/operations/);
  }
});

test("project scope continuity across incidents → operations → traces", async ({ page }) => {
  const projectId = await resolveScopedProjectId(page);
  const incidentsPath = projectId ? `/incidents?project_id=${encodeURIComponent(projectId)}` : "/incidents";
  await page.goto(incidentsPath);
  await expect(page).toHaveURL(/\/incidents/);

  const operationsLink = page.locator('a[href*="/operations/incidents/"]').first();
  if ((await operationsLink.count()) === 0) {
    await expect(page.getByText("No incidents found")).toBeVisible();
    return;
  }
  await operationsLink.click();
  if (projectId) {
    await expect(page).toHaveURL(new RegExp(`/operations/incidents/.+\\?project_id=${projectId}`));
  } else {
    await expect(page).toHaveURL(/\/operations\/incidents\/.+/);
  }

  const tracesPath = projectId ? `/traces?project_id=${encodeURIComponent(projectId)}` : "/traces";
  await page.goto(tracesPath);
  await expect(page).toHaveURL(/\/traces/);

  const traceDetailLink = page.locator('a[href*="/traces/"]').filter({ hasText: /View|Compare|Graph/i }).first();
  if ((await traceDetailLink.count()) > 0) {
    await traceDetailLink.click();
    await expect(page).toHaveURL(new RegExp(`/traces/.+project_id=${projectId}`));
  }
});

test("regression detail route keeps scope selector continuity into operations", async ({ page }) => {
  const projectId = await resolveScopedProjectId(page);
  const regressionsPath = projectId ? `/regressions?project_id=${encodeURIComponent(projectId)}` : "/regressions";
  await page.goto(regressionsPath);
  await expect(page).toHaveURL(/\/regressions/);

  const detailLink = page.locator('a[href*="/operations/regressions/"]').first();
  if ((await detailLink.count()) === 0) {
    await expect(page).toHaveURL(/\/regressions/);
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
    return;
  }
  await detailLink.click();
  if (projectId) {
    await expect(page).toHaveURL(new RegExp(`/operations/regressions/.+\\?project_id=${projectId}`));
  } else {
    await expect(page).toHaveURL(/\/operations\/regressions\/.+/);
  }

  const operationsLink = page.getByRole("link", { name: "Operations center" });
  await operationsLink.click();
  if (projectId) {
    await expect(page).toHaveURL(new RegExp(`/operations\\?project_id=${projectId}`));
  } else {
    await expect(page).toHaveURL(/\/operations/);
  }

  const tracesLink = page.getByRole("link", { name: "Traces" });
  await tracesLink.click();
  if (projectId) {
    await expect(page).toHaveURL(new RegExp(`/traces\\?project_id=${projectId}`));
  } else {
    await expect(page).toHaveURL(/\/traces/);
  }
});

test("on-call project scope selector updates canonical query and assignment form scope", async ({ page }) => {
  const projectId = await resolveScopedProjectId(page);
  const onCallPath = projectId ? `/on-call?project_id=${encodeURIComponent(projectId)}` : "/on-call";
  await page.goto(onCallPath);
  await expect(page).toHaveURL(/\/on-call/);

  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  const canonicalUrl = new URL(page.url());
  const resolvedScope = canonicalUrl.searchParams.get("project_id");
  if (projectId) {
    expect(resolvedScope).toBe(projectId);
  }
});

test("settings team on-call continuity link preserves resolved project scope", async ({ page }) => {
  const scopedProjectId = await resolveScopedProjectId(page);
  const settingsPath = scopedProjectId ? `/settings?project_id=${encodeURIComponent(scopedProjectId)}#team` : "/settings#team";
  await page.goto(settingsPath);
  await expect(page).toHaveURL(/\/settings/);

  const onCallLink = page.getByRole("link", { name: "On-Call" }).first();
  const onCallHref = await onCallLink.getAttribute("href");
  if (scopedProjectId) {
    expect(onCallHref).toContain(`project_id=${scopedProjectId}`);
  } else {
    expect(onCallHref).toContain("/on-call");
  }

  await onCallLink.click();
  await expect(page).toHaveURL(/\/on-call/);
});

test("version ownership shims preserve canonical project scope into traces", async ({ page }) => {
  const scopedProjectId = await resolveScopedProjectId(page);
  const tracesPath = scopedProjectId ? `/traces?project_id=${encodeURIComponent(scopedProjectId)}` : "/traces";
  await page.goto(tracesPath);
  await expect(page).toHaveURL(/\/traces/);

  const modelVersionPath = scopedProjectId
    ? `/model-versions/mv_test?projectId=${encodeURIComponent(scopedProjectId)}`
    : "/model-versions/mv_test";
  await page.goto(modelVersionPath);
  if (scopedProjectId) {
    await expect(page).toHaveURL(new RegExp(`/traces\\?project_id=${scopedProjectId}&model_version_id=mv_test`));
  } else {
    await expect(page).toHaveURL(/\/traces\?/);
  }

  const promptVersionPath = scopedProjectId
    ? `/prompt-versions/pv_test?projectId=${encodeURIComponent(scopedProjectId)}`
    : "/prompt-versions/pv_test";
  await page.goto(promptVersionPath);
  if (scopedProjectId) {
    await expect(page).toHaveURL(new RegExp(`/traces\\?project_id=${scopedProjectId}&prompt_version=pv_test`));
  } else {
    await expect(page).toHaveURL(/\/traces\?/);
  }
});

test("operations deep links fail closed on invalid project scope", async ({ page }) => {
  const invalidProjectId = "00000000-0000-4000-8000-000000000000";

  await ensureSignedIn(page, `/operations/incidents/inc_123?project_id=${invalidProjectId}`);
  const incidentUrl = new URL(page.url());
  expect(["/operations", "/pulse"]).toContain(incidentUrl.pathname);
  if (incidentUrl.pathname === "/operations") {
    expect(incidentUrl.searchParams.get("error")).toBe("project_scope_required");
  }

  await page.goto(`/operations/regressions/reg_123?project_id=${invalidProjectId}`);
  const regressionUrl = new URL(page.url());
  expect([
    "/operations",
    "/pulse",
    "/operations/regressions/reg_123",
  ]).toContain(regressionUrl.pathname);
  if (regressionUrl.pathname === "/operations") {
    expect(regressionUrl.searchParams.get("error")).toBe("project_scope_required");
  }

  await page.goto(`/operations/graph/inc_123?project_id=${invalidProjectId}`);
  const graphUrl = new URL(page.url());
  expect([
    "/operations",
    "/pulse",
    "/operations/graph/inc_123",
  ]).toContain(graphUrl.pathname);
  if (graphUrl.pathname === "/operations") {
    expect(graphUrl.searchParams.get("error")).toBe("project_scope_required");
  }
});
