import assert from "node:assert/strict";
import test from "node:test";

import {
  validateControlledExecutionConfirmation,
  validateControlledExecutionRequest,
} from "../lib/controlled-execution";

const baseRequest = {
  execution_id: "exec_1",
  proposal_id: "proposal_1",
  action_type: "open_remediation_task",
  target_type: "incident",
  target_id: "inc_1",
  approved_by_user_id: "op_1",
  approved_at: "2026-05-09T10:00:00.000Z",
  evidence_refs: [
    { label: "Incident", href: "/incidents/INC-1" },
    { label: "Trace", href: "/traces/TR-1" },
  ],
  dry_run_result_id: null,
  request_context: {
    organization_id: "org_1",
    project_id: "proj_1",
    environment_id: "production",
  },
} as const;

test("accepts valid non-mutating request", () => {
  const result = validateControlledExecutionRequest(baseRequest, new Date("2026-05-09T10:01:00.000Z"));
  assert.equal(result.ok, true);
});

test("rejects invalid action/target pair", () => {
  const result = validateControlledExecutionRequest(
    { ...baseRequest, action_type: "ack", target_type: "deployment" },
    new Date("2026-05-09T10:01:00.000Z"),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /not allowed/);
  }
});

test("rejects rollback without dry run and environment", () => {
  const result = validateControlledExecutionRequest(
    {
      ...baseRequest,
      action_type: "rollback",
      target_type: "deployment",
      dry_run_result_id: null,
      request_context: { ...baseRequest.request_context, environment_id: null },
    },
    new Date("2026-05-09T10:01:00.000Z"),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /dry_run_result_id/);
    assert.match(result.errors.join(" "), /environment_id/);
  }
});

test("rejects external evidence href", () => {
  const result = validateControlledExecutionRequest(
    {
      ...baseRequest,
      evidence_refs: [{ label: "External", href: "https://example.com" }],
    },
    new Date("2026-05-09T10:01:00.000Z"),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /non-internal href/);
  }
});

test("accepts valid execution confirmation payload", () => {
  const result = validateControlledExecutionConfirmation(
    {
      proposal_id: "proposal_1",
      approval_state: "approved",
      approved_by_user_id: "op_1",
      approved_at: "2026-05-09T10:00:00.000Z",
      confirmation_text: "CONFIRM",
      target_summary: "Rollback deployment dep_1 in production",
      reversibility: "reversible",
    },
    new Date("2026-05-09T10:01:00.000Z"),
  );
  assert.equal(result.ok, true);
});

test("rejects confirmation payload without explicit confirm token", () => {
  const result = validateControlledExecutionConfirmation(
    {
      proposal_id: "proposal_1",
      approval_state: "approved",
      approved_by_user_id: "op_1",
      approved_at: "2026-05-09T10:00:00.000Z",
      confirmation_text: "YES",
      target_summary: "Rollback deployment dep_1 in production",
      reversibility: "reversible",
    },
    new Date("2026-05-09T10:01:00.000Z"),
  );
  assert.equal(result.ok, false);
});
