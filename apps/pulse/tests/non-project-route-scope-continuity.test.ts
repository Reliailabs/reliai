import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), "utf8");
}

const NON_PROJECT_SCOPE_PAGES = [
  "app/(app)/incidents/page.tsx",
  "app/(app)/traces/page.tsx",
  "app/(app)/audits/page.tsx",
  "app/(app)/audits/new/page.tsx",
  "app/(app)/deployments/page.tsx",
  "app/(app)/metrics/page.tsx",
  "app/(app)/errors/page.tsx",
  "app/(app)/operations/page.tsx",
];

test("non-project routes resolve scope and pass selectedProjectId into shell", () => {
  for (const filePath of NON_PROJECT_SCOPE_PAGES) {
    const file = read(filePath);
    assert.match(file, /searchParams: Promise<\{ project_id\?: string \}>/);
    assert.match(file, /const \{ project_id: projectIdParam \} = await searchParams/);
    assert.match(file, /resolveScopedProjectId\(projects, projectIdParam\)/);
    assert.match(file, /projectScope=\{\{/);
    assert.match(file, /selectedProjectId/);
  }
});

test("non-project compat redirects normalize invalid project_id through resolved scope", () => {
  const incidentCommandCompat = read("app/(app)/incidents/[incidentId]/command/page.tsx");
  const incidentInvestigateAlias = read("app/(app)/incidents/[incidentId]/investigate/page.tsx");
  const incidentCompareAlias = read("app/(app)/incidents/[incidentId]/compare/page.tsx");
  const regressionCompareShim = read("app/(app)/regressions/[regressionId]/compare/page.tsx");

  for (const file of [incidentCommandCompat, incidentInvestigateAlias, incidentCompareAlias, regressionCompareShim]) {
    assert.match(file, /const \{ project_id: projectIdParam \} = await searchParams/);
    assert.match(file, /const projects = await listProjectScopeOptions\(\)/);
    assert.match(file, /const selectedProjectId = resolveScopedProjectId\(projects, projectIdParam\)/);
  }
});

test("non-project list content preserves project_id on cross-route links", () => {
  const incidentsContent = read("components/dashboard/content/incidents-content.tsx");
  const auditsContent = read("components/dashboard/content/audits-content.tsx");
  const deploymentsContent = read("components/dashboard/content/deployments-content.tsx");

  for (const file of [incidentsContent, auditsContent, deploymentsContent]) {
    assert.match(file, /const scopedProjectId = searchParams\.get\("project_id"\)/);
    assert.match(file, /function withScopedProject\(path: string\): string/);
  }
});
