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

test("errors and metrics routes preserve project scope via resolved loader inputs", () => {
  const errors = read("app/(app)/errors/page.tsx");
  const metrics = read("app/(app)/metrics/page.tsx");

  for (const file of [errors, metrics]) {
    assert.match(file, /searchParams: Promise<\{ project_id\?: string \}>/);
    assert.match(file, /resolveScopedProjectId\(projects, projectIdParam\)/);
    assert.match(file, /projectScope=\{\{ projects, selectedProjectId \}\}/);
  }

  assert.match(errors, /getErrorsSurfaceData\(selectedProjectId \?\? undefined\)/);
  assert.match(metrics, /getMetricsSurfaceData\(selectedProjectId\)/);
});

test("pulse, guardrails, services, and postmortems routes expose project scope and resolved loaders", () => {
  const pulse = read("app/(app)/pulse/page.tsx");
  const guardrails = read("app/(app)/guardrails/page.tsx");
  const services = read("app/(app)/services/page.tsx");
  const postmortems = read("app/(app)/postmortems/page.tsx");
  const playground = read("app/(app)/playground/page.tsx");

  for (const file of [pulse, guardrails, services, postmortems, playground]) {
    assert.match(file, /resolveScopedProjectId\(projects, projectIdParam/);
  }
  for (const file of [pulse, guardrails, services, postmortems]) {
    assert.match(file, /projectScope=\{\{ projects, selectedProjectId \}\}/);
  }

  assert.match(pulse, /getPulseOverviewData\(\{ demoMode, organizationId, projectId: selectedProjectId \}\)/);
  assert.match(guardrails, /getGuardrailsSurfaceData\(organizationId, selectedProjectId \?\? undefined\)/);
  assert.match(services, /getServicesSurfaceData\(selectedProjectId \?\? undefined\)/);
  assert.match(postmortems, /getPostmortemsSurfaceData\(selectedProjectId \?\? undefined\)/);
  assert.match(playground, /searchParams: Promise<\{ project_id\?: string \}>/);
  assert.match(playground, /<ProjectScopeSelector projects=\{projects\} selectedProjectId=\{selectedProjectId\} \/>/);
  assert.match(playground, /href=\{`\/pulse\$\{scopeQuery\}`\}/);
  assert.match(playground, /href=\{`\/operations\$\{scopeQuery\}`\}/);
  assert.match(playground, /href=\{`\/traces\$\{scopeQuery\}`\}/);
});

test("audit and deployment content links preserve project scope query", () => {
  const auditsContent = read("components/dashboard/content/audits-content.tsx");
  const deploymentsContent = read("components/dashboard/content/deployments-content.tsx");

  assert.match(auditsContent, /const scopedProjectId = searchParams\.get\("project_id"\)/);
  assert.match(auditsContent, /function withScopedProject\(path: string\): string/);
  assert.match(auditsContent, /href=\{withScopedProject\(`\/audits\/\$\{selectedAuditId\}\/results`\)\}/);
  assert.match(auditsContent, /href=\{withScopedProject\(`\/audits\/\$\{page\.id\}`\)\}/);
  assert.match(auditsContent, /href=\{withScopedProject\(`\/audits\/\$\{page\.id\}\/results`\)\}/);

  assert.match(deploymentsContent, /const scopedProjectId = searchParams\.get\("project_id"\)/);
  assert.match(deploymentsContent, /function withScopedProject\(path: string\): string/);
  assert.match(deploymentsContent, /href=\{withScopedProject\(`\/deployments\/\$\{deploy\.id\}`\)\}/);
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
  assert.match(investigateAlias, /const selectedProjectId = resolveScopedProjectId\(projects, projectIdParam\)/);
  assert.match(compareAlias, /const selectedProjectId = resolveScopedProjectId\(projects, projectIdParam\)/);
  assert.match(investigateAlias, /toIncidentOperationsAliasPath\(incidentId, "investigate", selectedProjectId\)/);
  assert.match(compareAlias, /toIncidentOperationsAliasPath\(incidentId, "compare", selectedProjectId\)/);
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
  const selector = read("components/onboarding/onboarding-project-scope-selector.tsx");
  assert.match(file, /searchParams: Promise<\{ path\?: string; autostart\?: string; api_key\?: string; project_id\?: string; error\?: string \}>/);
  assert.match(file, /const projectScopeQuery = primaryProjectId \? `&project_id=\$\{encodeURIComponent\(primaryProjectId\)\}` : \"\"/);
  assert.match(file, /const preferredProjectId = String\(formData\.get\("project_id"\) \?\? ""\)\.trim\(\) \|\| projectIdParam \|\| null/);
  assert.match(file, /const explicitProject =/);
  assert.match(file, /await getProject\(projectIdParam\)/);
  assert.match(file, /await getProject\(preferredProjectId\)/);
  assert.match(file, /const returnTo = `\/onboarding\?path=simulation&autostart=1\$\{projectIdParam \? `&project_id=\$\{encodeURIComponent\(projectIdParam\)\}` : ""\}`/);
  assert.match(file, /<input type="hidden" name="project_id" value=\{primaryProjectId\} \/>/);
  assert.match(file, /<OnboardingProjectScopeSelector/);
  assert.match(selector, /const params = new URLSearchParams\(searchParams\.toString\(\)\)/);
  assert.match(selector, /params\.set\("path", selectedPath\)/);
  assert.match(selector, /params\.set\("project_id", nextProjectId\)/);
  assert.match(selector, /router\.replace\(`\$\{pathname\}\?\$\{params\.toString\(\)\}`\)/);
});

test("on-call route uses canonical project_id scope query and shared selector behavior", () => {
  const file = read("app/(app)/on-call/page.tsx");
  const responseTeamRoute = read("app/api/oncall/response-team/route.ts");
  const rightPanel = read("components/dashboard/right-panel.tsx");
  assert.match(file, /searchParams: Promise<\{ project_id\?: string; projectId\?: string \}>/);
  assert.match(file, /const projectIdParam = params\.project_id \?\? params\.projectId \?\? null/);
  assert.match(file, /const selectedProjectId = resolveStrictScopedProjectId\(projects, projectIdParam\) \?\? ""/);
  assert.match(file, /redirect\("\/on-call\?error=project_scope_required"\)/);
  assert.match(file, /redirect\(`\/on-call\?project_id=\$\{encodeURIComponent\(selectedProjectId\)\}`\)/);
  assert.match(file, /<ProjectScopeSelector projects=\{projects\} selectedProjectId=\{selectedProjectId\} \/>/);
  assert.match(responseTeamRoute, /const projectIdParam = searchParams\.get\("project_id"\) \?\? searchParams\.get\("projectId"\)/);
  assert.match(responseTeamRoute, /const projectId = resolveStrictScopedProjectId\(projects, projectIdParam\)/);
  assert.match(responseTeamRoute, /project_scope_required/);
  assert.match(rightPanel, /\/api\/oncall\/response-team\?project_id=\$\{encodeURIComponent\(projectId\)\}/);
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
  assert.match(file, /const selectedProjectId = resolveScopedProjectId\(projects, projectIdParam\)/);
  assert.match(file, /getRegressionOperationsSurfaceData\(regressionId, selectedProjectId\)/);
});

test("regression navigation links and compare shim preserve project scope query", () => {
  const regressionsList = read("app/(app)/regressions/page.tsx");
  const regressionDetail = read("app/(app)/regressions/[regressionId]/page.tsx");
  const projectRegressions = read("app/(app)/projects/[projectId]/regressions/page.tsx");
  const compareShim = read("app/(app)/regressions/[regressionId]/compare/page.tsx");

  assert.match(regressionsList, /<AppShellFrame activeSection="regressions" projectScope=\{\{ projects, selectedProjectId \}\}>/);
  assert.match(regressionsList, /href=\{`\/operations\/regressions\/\$\{item\.id\}\$\{scopeQuery\}`\}/);
  assert.match(regressionDetail, /searchParams: Promise<\{ project_id\?: string \}>/);
  assert.match(regressionDetail, /const selectedProjectId = resolveScopedProjectId\(projects, projectIdParam\)/);
  assert.match(regressionDetail, /<AppShellFrame activeSection="regressions" projectScope=\{\{ projects, selectedProjectId \}\}>/);
  assert.match(regressionDetail, /<ProjectScopeSelector projects=\{projects\} selectedProjectId=\{selectedProjectId \?\? null\} \/>/);
  assert.match(regressionDetail, /href=\{`\/operations\/regressions\/\$\{item\.id\}\$\{scopeQuery\}`\}/);
  assert.match(projectRegressions, /href=\{`\/operations\/regressions\/\$\{item\.id\}\?project_id=\$\{encodeURIComponent\(projectId\)\}`\}/);
  assert.match(compareShim, /const selectedProjectId = resolveScopedProjectId\(projects, projectIdParam\)/);
  assert.match(compareShim, /const scopeQuery = selectedProjectId \? `\?project_id=\$\{encodeURIComponent\(selectedProjectId\)\}` : ""/);
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
  assert.match(operationsIncident, /const selectedProjectId = resolveScopedProjectId\(projects, projectIdParam\)/);
  assert.match(operationsIncident, /getIncidentOperationsSurfaceData\(incidentId, \{ projectId: selectedProjectId \}\)/);
  assert.match(operationsIncident, /projectScope=\{\{ projects, selectedProjectId \}\}/);
  assert.match(operationsGraph, /searchParams: Promise<\{ project_id\?: string \}>/);
  assert.match(operationsGraph, /getOperationsGraphSurfaceData\(entityId, selectedProjectId\)/);
  assert.match(operationsGraph, /projectScope=\{\{ projects, selectedProjectId \}\}/);
  assert.match(operationsGraphSurface, /<ProjectScopeSelector/);
  assert.match(operationsGraphSurface, /const scopeQuery = projectScope\?\.selectedProjectId/);
  assert.match(operationsGraphSurface, /href=\{`\/operations\$\{scopeQuery\}`\}/);
  assert.match(graphData, /const scopeQuery = projectId \? `\?project_id=\$\{encodeURIComponent\(projectId\)\}` : ""/);
  assert.match(incidentOpsSurface, /href=\{`\/operations\$\{scopeQuery\}`\}/);
  assert.match(regressionOpsSurface, /href=\{`\/operations\$\{scopeQuery\}`\}/);
  assert.match(regressionOpsSurface, /const scopedProjectId = searchParams\.get\("project_id"\) \?\? data\.projectId/);
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
  assert.match(runner, /const withScopedProject = useCallback\(/);
  assert.match(runner, /<Link href=\{withScopedProject\("\/onboarding\?path=sdk"\)\}>Connect SDK instead<\/Link>/);
  assert.match(runner, /router\.push\(`\/incidents\/\$\{simulationStatus\.incident_id\}\/command\$\{scopeQuery\}`\)/);
  assert.match(incidentCommandCompat, /searchParams: Promise<\{ project_id\?: string \}>/);
  assert.match(incidentCommandCompat, /const selectedProjectId = resolveScopedProjectId\(projects, projectIdParam\)/);
  assert.match(incidentCommandCompat, /const scopeQuery = selectedProjectId \? `\?project_id=\$\{encodeURIComponent\(selectedProjectId\)\}` : ""/);
  assert.match(incidentCommandCompat, /redirect\(`\/incidents\/\$\{incidentId\}\$\{scopeQuery\}`\)/);
  assert.match(reliability, /href=\{`\/incidents\/\$\{incident\.id\}\?project_id=\$\{encodeURIComponent\(projectId\)\}`\}/);
  assert.match(tracesData, /comparePath: `\/traces\/\$\{trace\.id\}\/compare\$\{scopeQuery\}`/);
  assert.match(tracesData, /graphPath: `\/traces\/\$\{trace\.id\}\/graph\$\{scopeQuery\}`/);
  assert.match(incidentsData, /const scopeQuery = projectId \? `\?project_id=\$\{encodeURIComponent\(projectId\)\}` : ""/);
  assert.match(incidentsData, /href: `\/traces\$\{scopeQuery\}`/);
  assert.match(incidentsData, /href: `\/deployments\$\{scopeQuery\}#\$\{deploymentId\}`/);
});

test("performance trace links and evidence references preserve project scope", () => {
  const performanceContent = read("components/dashboard/content/performance-content.tsx");
  assert.match(performanceContent, /const scopedProjectId = searchParams\.get\("project_id"\)/);
  assert.match(performanceContent, /function withScopedProject\(path: string\): string/);
  assert.match(performanceContent, /href=\{withScopedProject\(`\/traces\/\$\{trace\.id\}`\)\}/);
  assert.match(performanceContent, /href=\{withScopedProject\(`\/traces\/\$\{selectedTraceRef\.id\}\/compare`\)\}/);
  assert.match(performanceContent, /href=\{withScopedProject\(`\/traces\/\$\{selectedTraceRef\.id\}\/graph`\)\}/);
  assert.match(performanceContent, /href=\{withScopedProject\(ref\.href\)\}/);
});

test("overview advisory links preserve project scope query", () => {
  const overviewContent = read("components/dashboard/content/overview-content.tsx");
  assert.match(overviewContent, /const scopedProjectId = searchParams\.get\("project_id"\)/);
  assert.match(overviewContent, /function withScopedProject\(path: string\): string/);
  assert.match(overviewContent, /href=\{withScopedProject\(link\.href\)\}/);
});
