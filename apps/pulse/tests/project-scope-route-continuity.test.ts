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
  assert.match(file, /href=\{withScopedProject\(`\/operations\/incidents\/\$\{incident\.id\}`\)\}/);
  assert.match(file, /router\.push\(withScopedProject\(`\/operations\/incidents\/\$\{selectedIncident\.id\}`\)\)/);
});

test("incident investigate/compare aliases preserve project scope query", () => {
  const investigateAlias = read("app/(app)/incidents/[incidentId]/investigate/page.tsx");
  const compareAlias = read("app/(app)/incidents/[incidentId]/compare/page.tsx");
  const aliasLib = read("lib/incident-deeplink-alias.ts");

  assert.match(investigateAlias, /searchParams: Promise<\{ project_id\?: string \}>/);
  assert.match(compareAlias, /searchParams: Promise<\{ project_id\?: string \}>/);
  assert.match(investigateAlias, /toIncidentOperationsAliasPath\(incidentId, "investigate", projectIdParam\)/);
  assert.match(compareAlias, /toIncidentOperationsAliasPath\(incidentId, "compare", projectIdParam\)/);
  assert.match(aliasLib, /scopeQuery = projectId \? `&project_id=\$\{encodeURIComponent\(projectId\)\}` : ""/);
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

test("scoped loaders avoid implicit first-project fallback", () => {
  const tracesData = read("lib/traces-data.ts");
  const regressionsData = read("lib/regressions-data.ts");
  const regressionOps = read("lib/regression-operations-data.ts");
  const errorsData = read("lib/errors-data.ts");

  for (const file of [tracesData, regressionsData, regressionOps, errorsData]) {
    assert.doesNotMatch(file, /items\?\.\[0\]/);
    assert.match(file, /resolveScopedProjectId\(/);
  }
});

test("regression operations detail route preserves explicit project scope", () => {
  const file = read("app/(app)/operations/regressions/[regressionId]/page.tsx");
  assert.match(file, /searchParams: Promise<\{ project_id\?: string \}>/);
  assert.match(file, /const \{ project_id: projectIdParam \} = await searchParams/);
  assert.match(file, /getRegressionOperationsSurfaceData\(regressionId, projectIdParam\)/);
});

test("regression navigation links and compare shim preserve project scope query", () => {
  const regressionsList = read("app/(app)/regressions/page.tsx");
  const projectRegressions = read("app/(app)/projects/[projectId]/regressions/page.tsx");
  const compareShim = read("app/(app)/regressions/[regressionId]/compare/page.tsx");

  assert.match(regressionsList, /href=\{`\/operations\/regressions\/\$\{item\.id\}\$\{scopeQuery\}`\}/);
  assert.match(projectRegressions, /href=\{`\/operations\/regressions\/\$\{item\.id\}\?project_id=\$\{encodeURIComponent\(projectId\)\}`\}/);
  assert.match(compareShim, /const scopeQuery = projectIdParam \? `\?project_id=\$\{encodeURIComponent\(projectIdParam\)\}` : ""/);
  assert.match(compareShim, /redirect\(`\/operations\/regressions\/\$\{regressionId\}\$\{scopeQuery\}`\)/);
});

test("operations incident and graph routes preserve explicit project scope", () => {
  const operationsIncident = read("app/(app)/operations/incidents/[incidentId]/page.tsx");
  const operationsGraph = read("app/(app)/operations/graph/[entityId]/page.tsx");
  const operationsGraphSurface = read("components/operations/operations-graph-surface.tsx");
  const regressionOpsSurface = read("components/operations/regression-operations-surface.tsx");
  const incidentOpsSurface = read("components/operations/incident-operations-surface.tsx");
  const graphData = read("lib/operations-graph-data.ts");

  assert.match(operationsIncident, /searchParams: Promise<\{ project_id\?: string \}>/);
  assert.match(operationsIncident, /getIncidentOperationsSurfaceData\(incidentId, \{ projectId: projectIdParam \}\)/);
  assert.match(operationsIncident, /projectScope=\{\{ projects, selectedProjectId \}\}/);
  assert.match(operationsGraph, /searchParams: Promise<\{ project_id\?: string \}>/);
  assert.match(operationsGraph, /getOperationsGraphSurfaceData\(entityId, projectIdParam\)/);
  assert.match(operationsGraph, /projectScope=\{\{ projects, selectedProjectId \}\}/);
  assert.match(operationsGraphSurface, /<ProjectScopeSelector/);
  assert.match(operationsGraphSurface, /const scopeQuery = projectScope\?\.selectedProjectId/);
  assert.match(operationsGraphSurface, /href=\{`\/operations\$\{scopeQuery\}`\}/);
  assert.match(graphData, /const scopeQuery = projectId \? `\?project_id=\$\{encodeURIComponent\(projectId\)\}` : ""/);
  assert.match(incidentOpsSurface, /href=\{`\/operations\$\{scopeQuery\}`\}/);
  assert.match(regressionOpsSurface, /href=\{`\/operations\$\{scopeQuery\}`\}/);
  assert.match(regressionOpsSurface, /const scopedProjectId = searchParams\.get\("project_id"\)/);
  assert.match(incidentOpsSurface, /const scopedProjectId = searchParams\.get\("project_id"\) \?\? data\.projectId/);
  assert.match(regressionOpsSurface, /<ProjectScopeSelector/);
  assert.match(incidentOpsSurface, /<ProjectScopeSelector/);
});

test("simulation handoff and reliability/trace evidence links preserve project scope", () => {
  const runner = read("components/onboarding/onboarding-simulation-runner.tsx");
  const incidentCommandCompat = read("app/(app)/incidents/[incidentId]/command/page.tsx");
  const reliability = read("app/(app)/projects/[projectId]/reliability/page.tsx");
  const tracesData = read("lib/traces-data.ts");
  const incidentsData = read("lib/incidents-data.ts");

  assert.match(runner, /const scopedProjectId = searchParams\.get\("project_id"\)/);
  assert.match(runner, /router\.push\(`\/incidents\/\$\{simulationStatus\.incident_id\}\/command\$\{scopeQuery\}`\)/);
  assert.match(incidentCommandCompat, /searchParams: Promise<\{ project_id\?: string \}>/);
  assert.match(incidentCommandCompat, /const scopeQuery = projectIdParam \? `\?project_id=\$\{encodeURIComponent\(projectIdParam\)\}` : ""/);
  assert.match(incidentCommandCompat, /redirect\(`\/incidents\/\$\{incidentId\}\$\{scopeQuery\}`\)/);
  assert.match(reliability, /href=\{`\/incidents\/\$\{incident\.id\}\?project_id=\$\{encodeURIComponent\(projectId\)\}`\}/);
  assert.match(tracesData, /comparePath: `\/traces\/\$\{trace\.id\}\/compare\$\{scopeQuery\}`/);
  assert.match(tracesData, /graphPath: `\/traces\/\$\{trace\.id\}\/graph\$\{scopeQuery\}`/);
  assert.match(incidentsData, /const scopeQuery = projectId \? `\?project_id=\$\{encodeURIComponent\(projectId\)\}` : ""/);
  assert.match(incidentsData, /href: `\/traces\$\{scopeQuery\}`/);
  assert.match(incidentsData, /href: `\/deployments\$\{scopeQuery\}#\$\{deploymentId\}`/);
});
