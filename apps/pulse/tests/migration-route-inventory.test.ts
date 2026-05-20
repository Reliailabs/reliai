import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const REQUIRED_PULSE_ROUTE_FILES = [
  "app/(app)/incidents/page.tsx",
  "app/(app)/incidents/[incidentId]/page.tsx",
  "app/(app)/incidents/[incidentId]/investigate/page.tsx",
  "app/(app)/incidents/[incidentId]/compare/page.tsx",
  "app/(app)/traces/page.tsx",
  "app/(app)/traces/[traceId]/page.tsx",
  "app/(app)/traces/[traceId]/compare/page.tsx",
  "app/(app)/traces/[traceId]/graph/page.tsx",
  "app/(app)/audits/page.tsx",
  "app/(app)/audits/[id]/page.tsx",
  "app/(app)/audits/[id]/results/page.tsx",
  "app/(app)/audits/new/page.tsx",
  "app/(app)/deployments/page.tsx",
  "app/(app)/deployments/[deploymentId]/page.tsx",
  "app/(app)/operations/page.tsx",
  "app/(app)/operations/incidents/[incidentId]/page.tsx",
  "app/(app)/operations/regressions/[regressionId]/page.tsx",
  "app/(app)/operations/graph/[entityId]/page.tsx",
  "app/(app)/projects/page.tsx",
  "app/(app)/projects/[projectId]/page.tsx",
  "app/(app)/projects/[projectId]/reliability/page.tsx",
  "app/(app)/projects/[projectId]/regressions/page.tsx",
  "app/(app)/projects/[projectId]/timeline/page.tsx",
  "app/(app)/projects/[projectId]/ingestion/page.tsx",
  "app/(app)/projects/[projectId]/processors/page.tsx",
  "app/(app)/projects/[projectId]/settings/page.tsx",
  "app/(app)/onboarding/page.tsx",
  "app/(app)/settings/page.tsx",
  "app/(app)/settings/billing/page.tsx",
  "app/(app)/billing/success/page.tsx",
  "app/(app)/playground/page.tsx",
  "app/(marketing)/docs/page.tsx",
] as const;

function pulsePath(relPath: string): string {
  return path.join(process.cwd(), relPath);
}

test("migration inventory: required Pulse route files exist", () => {
  const missing = REQUIRED_PULSE_ROUTE_FILES.filter((routeFile) => !existsSync(pulsePath(routeFile)));
  assert.deepEqual(missing, []);
});
