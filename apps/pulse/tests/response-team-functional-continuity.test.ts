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
  assert.match(file, /signup_path: "\/signup"/);
  assert.match(file, /ownership: "existing_account_required"/);
});

test("on-call page uses organization members as assignment source and separates access-role vs duty-role semantics", () => {
  const onCallFile = read("app/(app)/on-call/page.tsx");
  const settingsFile = read("components/dashboard/content/settings-content.tsx");
  assert.match(onCallFile, /apiRequest<\{ items: TeamMember\[\] \}>/);
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
  assert.match(file, /const settingsTeamHref = projectScope/);
  assert.match(file, /`\/settings\?project_id=\$\{encodeURIComponent\(projectScope\)\}#team`/);
  assert.match(file, /href=\{settingsTeamHref\}/);
  assert.match(file, /searchParams\.get\("project_id"\) \?\? searchParams\.get\("projectId"\)/);
  assert.match(file, /\/api\/oncall\/response-team\?project_id=\$\{encodeURIComponent\(projectId\)\}/);
});

test("team member add/remove and on-call assignment source stay on same org membership contract", () => {
  const teamRoute = read("app/api/settings/team/route.ts");
  const teamDeleteRoute = read("app/api/settings/team/[userId]/route.ts");
  const onCallPage = read("app/(app)/on-call/page.tsx");

  assert.match(teamRoute, /\/api\/v1\/organizations\/\$\{auth\.orgId\}\/members/);
  assert.match(teamDeleteRoute, /\/api\/v1\/organizations\/\$\{orgId\}\/members\/\$\{userId\}/);
  assert.match(onCallPage, /\/api\/v1\/organizations\/\$\{selectedProjectDetail\.organization_id\}\/members/);
  assert.match(onCallPage, /type TeamMember = \{\s*user_id: string;\s*display_name: string \| null;\s*email: string \| null;/s);
});

test("settings team UI makes external invite lifecycle ownership explicit", () => {
  const settingsFile = read("components/dashboard/content/settings-content.tsx");
  assert.match(settingsFile, /buildTeamInviteSignupHref\(inviteEmail\)/);
  assert.match(settingsFile, /href=\{signupInviteHref\}/);
  assert.match(settingsFile, /api\/settings\/team\/invitations/);
  assert.match(settingsFile, /Send invitation instead/);
  assert.match(settingsFile, /join link is now available below/);
  assert.match(settingsFile, /If they already have a Reliai account, use Add\./);
  assert.match(settingsFile, /Pending Invitations/);
  assert.match(settingsFile, /Open join link/);
  assert.match(settingsFile, /const joinReturnTo = projectScope/);
  assert.match(settingsFile, /params\.set\("return_to", joinReturnTo\)/);
  assert.match(settingsFile, /href=\{buildInvitationJoinHref\(invitation\.joinPath\)\}/);
  assert.match(settingsFile, /Delivery: manual join link \(email delivery deferred\)\./);
  assert.match(settingsFile, /Queued invites are visible here until accepted or revoked\./);
  assert.match(settingsFile, /Invitation emails are not auto-delivered from Pulse yet\./);
  assert.match(settingsFile, /Revoke/);
  assert.match(settingsFile, /queue a pending invitation/);
  assert.match(settingsFile, /Continue with account creation at \/signup/);
  assert.match(settingsFile, /searchParams\.get\("project_id"\) \?\? searchParams\.get\("projectId"\)/);
  assert.match(settingsFile, /const onCallHref = projectScope \? `\/on-call\?project_id=\$\{encodeURIComponent\(projectScope\)\}` : "\/on-call"/);
  assert.doesNotMatch(settingsFile, /must already have a Reliai account/i);
  assert.doesNotMatch(settingsFile, /coming soon/i);
});

test("settings quick settings copy no longer claims upcoming parity slices", () => {
  const settingsFile = read("components/dashboard/content/settings-content.tsx");
  assert.match(settingsFile, /Some controls remain intentionally stubbed/);
  assert.doesNotMatch(settingsFile, /upcoming parity slices/i);
});

test("settings team invitations route returns explicit manual delivery contract", () => {
  const routeFile = read("app/api/settings/team/invitations/route.ts");
  assert.match(routeFile, /delivery:\s*\{/);
  assert.match(routeFile, /mode:\s*"manual_join_link"/);
  assert.match(routeFile, /emailSent:\s*false/);
});
