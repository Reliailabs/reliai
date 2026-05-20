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
