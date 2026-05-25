import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function read(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), "utf8");
}

test("billing checkout route enforces org scope and fail-closed degraded behavior", () => {
  const file = read("app/api/billing/checkout/route.ts");
  assert.match(file, /active_organization_id/);
  assert.match(file, /if \(!token \|\| !activeOrgId\)/);
  assert.match(file, /if \(parsed\.data\.organization_id !== activeOrgId\)/);
  assert.match(file, /cache: "no-store"/);
  assert.match(file, /Cache-Control": "no-store"/);
  assert.match(file, /catch \{/);
  assert.match(file, /error: "checkout_unavailable"/);
  assert.match(file, /status: 503/);
});

test("settings team and invitation routes require auth and degrade without partial success", () => {
  const team = read("app/api/settings/team/route.ts");
  const teamMember = read("app/api/settings/team/[userId]/route.ts");
  const invites = read("app/api/settings/team/invitations/route.ts");
  const inviteById = read("app/api/settings/team/invitations/[invitationId]/route.ts");

  for (const file of [team, teamMember, invites, inviteById]) {
    assert.match(file, /getApiAccessToken/);
    assert.match(file, /getOperatorSession/);
    assert.match(file, /active_organization_id/);
    assert.match(file, /cache: "no-store"/);
    assert.match(file, /status: 401/);
    assert.match(file, /catch \{/);
  }

  assert.match(team, /return NextResponse\.json\(\{ items: \[\], organizationId: null \}, \{ status: 200 \}\)/);
  assert.match(invites, /return NextResponse\.json\(\{ items: \[\] \}, \{ status: 200 \}\)/);
  assert.match(teamMember, /return NextResponse\.json\(\{ error: "remove_failed" \}, \{ status: 500 \}\)/);
  assert.match(inviteById, /return NextResponse\.json\(\{ error: "revoke_failed" \}, \{ status: 500 \}\)/);
});

test("project-scope denial behavior remains contract-covered for invalid scope paths", () => {
  const scopeContracts = read("tests/project-scope-route-continuity.test.ts");
  assert.match(scopeContracts, /project_scope_required/);
  assert.match(scopeContracts, /operations incident and graph routes preserve explicit project scope/);
  assert.match(scopeContracts, /on-call route uses canonical project_id scope query and shared selector behavior/);
});
