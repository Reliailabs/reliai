import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), "utf8");
}

test("incidents detail route preserves project scope via searchParams and shell projectScope", () => {
  const file = read("app/(app)/incidents/[incidentId]/page.tsx");
  assert.match(file, /searchParams: Promise<\{ project_id\?: string \}>/);
  assert.match(file, /resolveScopedProjectId\(projects, projectIdParam\)/);
  assert.match(file, /getIncidentsSurfaceData\(selectedProjectId\)/);
  assert.match(file, /projectScope=\{\{ projects, selectedProjectId \}\}/);
});

test("traces detail routes preserve project scope via searchParams and shell projectScope", () => {
  const detail = read("app/(app)/traces/[traceId]/page.tsx");
  const compare = read("app/(app)/traces/[traceId]/compare/page.tsx");
  const graph = read("app/(app)/traces/[traceId]/graph/page.tsx");

  for (const file of [detail, compare, graph]) {
    assert.match(file, /searchParams: Promise<\{ project_id\?: string \}>/);
    assert.match(file, /resolveScopedProjectId\(projects, projectIdParam\)/);
    assert.match(file, /getTracesSurfaceData\(selectedProjectId\)/);
    assert.match(file, /projectScope=\{\{ projects, selectedProjectId \}\}/);
  }
});

test("audit and deployment routes preserve project scope on list and detail surfaces", () => {
  const files = [
    "app/(app)/audits/page.tsx",
    "app/(app)/audits/[id]/page.tsx",
    "app/(app)/audits/[id]/results/page.tsx",
    "app/(app)/deployments/page.tsx",
    "app/(app)/deployments/[deploymentId]/page.tsx",
  ];

  for (const filePath of files) {
    const file = read(filePath);
    assert.match(file, /searchParams: Promise<\{ project_id\?: string \}>/);
    assert.match(file, /resolveScopedProjectId\(projects, projectIdParam\)/);
    assert.match(file, /projectScope=\{\{ projects, selectedProjectId \}\}/);
  }
});

test("incident navigation actions preserve project_id query context", () => {
  const file = read("components/dashboard/content/incidents-content.tsx");
  assert.match(file, /const scopedProjectId = searchParams\.get\("project_id"\)/);
  assert.match(file, /function withScopedProject\(path: string\): string/);
  assert.match(file, /router\.push\(withScopedProject\(`\/incidents\/\$\{incident\.id\}`\)\)/);
  assert.match(file, /router\.push\(withScopedProject\(`\/operations\/incidents\/\$\{incident\.id\}`\)\)/);
  assert.match(file, /router\.push\(withScopedProject\(`\/operations\/incidents\/\$\{selectedIncident\.id\}`\)\)/);
});

test("operations route preserves project scope and forwards filter to operations data loader", () => {
  const file = read("app/(app)/operations/page.tsx");
  assert.match(file, /searchParams: Promise<\{ project_id\?: string \}>/);
  assert.match(file, /resolveScopedProjectId\(projects, projectIdParam\)/);
  assert.match(file, /getOperationsSurfaceData\(undefined, \{/);
  assert.match(file, /filter: selectedProjectId \? \{ project_id: selectedProjectId \} : undefined/);
  assert.match(file, /projectScope=\{\{ projects, selectedProjectId \}\}/);
});

test("onboarding route preserves explicit project scope for path transitions and api key generation", () => {
  const file = read("app/(app)/onboarding/page.tsx");
  assert.match(file, /searchParams: Promise<\{ path\?: string; autostart\?: string; api_key\?: string; project_id\?: string; error\?: string \}>/);
  assert.match(file, /const projectScopeQuery = primaryProjectId \? `&project_id=\$\{encodeURIComponent\(primaryProjectId\)\}` : \"\"/);
  assert.match(file, /const preferredProjectId = String\(formData\.get\("project_id"\) \?\? ""\)\.trim\(\) \|\| projectIdParam \|\| null/);
  assert.match(file, /const returnTo = `\/onboarding\?path=simulation&autostart=1\$\{projectIdParam \? `&project_id=\$\{encodeURIComponent\(projectIdParam\)\}` : ""\}`/);
  assert.match(file, /<input type="hidden" name="project_id" value=\{primaryProjectId\} \/>/);
  assert.match(file, /<select[\s\S]*name="project_id"/);
});

test("project-scoped routes pass projectId into data loaders", () => {
  const incidents = read("app/(app)/projects/[projectId]/incidents/page.tsx");
  const traces = read("app/(app)/projects/[projectId]/traces/page.tsx");
  const audits = read("app/(app)/projects/[projectId]/audits/page.tsx");

  assert.match(incidents, /const incidentsData = await getIncidentsSurfaceData\(projectId\)/);
  assert.match(traces, /const tracesData = await getTracesSurfaceData\(projectId\)/);
  assert.match(audits, /const auditsData = await getAuditsSurfaceData\(projectId\)/);
});

test("project overview route passes projectId through all overview presenters", () => {
  const file = read("app/(app)/projects/[projectId]/page.tsx");
  assert.match(file, /getPulseOverviewData\(\{ demoMode: false, organizationId, projectId \}\)/);
  assert.match(file, /getCausalityEvidenceData\(\{ demoMode: false, organizationId, projectId \}\)/);
  assert.match(file, /getAttributionSuggestionsData\(\{ demoMode: false, organizationId, projectId \}\)/);
});
