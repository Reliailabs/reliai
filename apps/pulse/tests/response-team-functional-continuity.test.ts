import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), "utf8");
}

test("settings team route enforces invite identity fields and role", () => {
  const file = read("app/api/settings/team/route.ts");
  assert.match(file, /if \(!body\.name \|\| !body\.email \|\| !body\.role\)/);
  assert.match(file, /return NextResponse\.json\(\{ error: "name, email and role are required" \}, \{ status: 400 \}\)/);
  assert.match(file, /lookup\?email=\$\{encodeURIComponent\(body\.email\.trim\(\)\.toLowerCase\(\)\)\}/);
  assert.match(file, /JSON\.stringify\(\{ user_id, role: body\.role, display_name: body\.name\.trim\(\) \}\)/);
});

test("on-call page uses organization members as assignment source and separates access-role vs duty-role semantics", () => {
  const onCallFile = read("app/(app)/on-call/page.tsx");
  const settingsFile = read("components/dashboard/content/settings-content.tsx");
  assert.match(onCallFile, /apiRequest<\{ items: TeamMember\[] \}>\(`/);
  assert.match(onCallFile, /\/api\/v1\/organizations\/\$\{selectedProjectDetail\.organization_id\}\/members/);
  assert.match(onCallFile, /These are response duty roles, not organization access roles\./);
  assert.match(onCallFile, /name=\{role\}/);
  assert.match(settingsFile, /On-call duty roles are configured separately in/);
});

test("response-team sidebar endpoint resolves by canonical project scope and maps known role order", () => {
  const file = read("app/api/oncall/response-team/route.ts");
  assert.match(file, /searchParams\.get\("project_id"\) \?\? searchParams\.get\("projectId"\)/);
  assert.match(file, /resolveScopedProjectId\(projects, projectIdParam\)/);
  assert.match(file, /const roleOrder: Record<string, \{ label: ResponseTeamMember\["role"\]; status: ResponseTeamMember\["status"\] \}>/);
  assert.match(file, /primary/);
  assert.match(file, /secondary/);
  assert.match(file, /lead/);
  assert.match(file, /sre/);
});

test("response-team right panel keeps Team Members remediation path visible", () => {
  const file = read("components/dashboard/right-panel.tsx");
  assert.match(file, /Configure team members/);
  assert.match(file, /href="\/settings#team"/);
  assert.match(file, /searchParams\.get\("project_id"\) \?\? searchParams\.get\("projectId"\)/);
  assert.match(file, /\/api\/oncall\/response-team\?project_id=\$\{encodeURIComponent\(projectId\)\}/);
});
