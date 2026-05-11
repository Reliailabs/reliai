import assert from "node:assert/strict";
import test from "node:test";

import { phase9ValidatorError, PHASE9_VALIDATOR_RESPONSE_CONTRACT } from "../app/api/actions/assisted-automation/_response";
import { validateAutomationEligibility } from "../lib/assisted-automation";

const basePayload = {
  proposal_id: "proposal_1",
  action_type: "open_remediation_task",
  target_type: "incident",
  target_id: "inc_1",
  request_context: {
    organization_id: "org_1",
    project_id: "proj_1",
    environment_id: "production",
  },
  evidence_refs: [
    { label: "Incident", href: "/incidents/INC-1" },
    { label: "Deployment", href: "/deployments/DEP-1" },
  ],
  signal_quality: {
    confidence: "medium",
    evidence_density: "medium",
  },
  safety: {
    has_rollback_path: true,
    has_safe_noop_fallback: true,
    policy_checks_passed: true,
    high_risk_environment: false,
  },
  approvals: {
    rbac_allows_approval: true,
    dual_approval_required: false,
  },
  blast_radius: {
    max_allowed_scope: "environment",
    estimated_scope: "environment",
  },
} as const;

test("eligible request passes with operator review required", () => {
  const result = validateAutomationEligibility(basePayload);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.eligibility.eligible, true);
    assert.equal(result.eligibility.required_approvals, 1);
    assert.equal(result.eligibility.requires_operator_review, true);
  }
});

test("insufficient confidence and evidence density denies eligibility", () => {
  const result = validateAutomationEligibility({
    ...basePayload,
    signal_quality: {
      confidence: "insufficient",
      evidence_density: "low",
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.eligibility.eligible, false);
    assert.deepEqual(result.eligibility.reason_codes, ["insufficient_confidence", "insufficient_evidence_density"]);
  }
});

test("high-risk environment requires dual approval", () => {
  const result = validateAutomationEligibility({
    ...basePayload,
    approvals: {
      ...basePayload.approvals,
      dual_approval_required: false,
    },
    safety: {
      ...basePayload.safety,
      high_risk_environment: true,
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.eligibility.required_approvals, 2);
    assert.match(result.warnings.join(" "), /dual approval required/);
  }
});

test("external evidence links are rejected", () => {
  const result = validateAutomationEligibility({
    ...basePayload,
    evidence_refs: [{ label: "External", href: "https://example.com" }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /non-internal href/);
  }
});

test("phase 9 validator envelope contract remains validation-only", () => {
  assert.equal(PHASE9_VALIDATOR_RESPONSE_CONTRACT.contract_version, "phase9-v1");
  assert.equal(PHASE9_VALIDATOR_RESPONSE_CONTRACT.mode, "validation_only");
  assert.equal(PHASE9_VALIDATOR_RESPONSE_CONTRACT.execution_granted, false);
});

test("phase 9 validator error helper uses invariant envelope", () => {
  const response = phase9ValidatorError("unauthorized");
  assert.equal(response.contract_version, "phase9-v1");
  assert.equal(response.mode, "validation_only");
  assert.equal(response.execution_granted, false);
  assert.equal(response.ok, false);
  assert.deepEqual(response.errors, ["unauthorized"]);
});

// ── Gate 1: tenant scope ──────────────────────────────────────────────────────

test("gate 1: null project_id produces tenant_scope_incomplete reason code", () => {
  const result = validateAutomationEligibility({
    ...basePayload,
    request_context: {
      ...basePayload.request_context,
      project_id: null,
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.eligibility.eligible, false);
    assert.ok(result.eligibility.reason_codes.includes("tenant_scope_incomplete"));
  }
});

test("gate 1: present project_id does not produce tenant_scope_incomplete", () => {
  const result = validateAutomationEligibility(basePayload);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(!result.eligibility.reason_codes.includes("tenant_scope_incomplete"));
  }
});

// ── Gate 6: blast radius boundary ────────────────────────────────────────────

test("gate 6: estimated_scope exceeding max_allowed_scope produces blast_radius_exceeds_boundary", () => {
  const result = validateAutomationEligibility({
    ...basePayload,
    blast_radius: {
      max_allowed_scope: "environment",
      estimated_scope: "organization",
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.eligibility.eligible, false);
    assert.ok(result.eligibility.reason_codes.includes("blast_radius_exceeds_boundary"));
  }
});

test("gate 6: estimated_scope equal to max_allowed_scope passes", () => {
  const result = validateAutomationEligibility({
    ...basePayload,
    blast_radius: {
      max_allowed_scope: "project",
      estimated_scope: "project",
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(!result.eligibility.reason_codes.includes("blast_radius_exceeds_boundary"));
  }
});

test("gate 6: estimated_scope narrower than max_allowed_scope passes", () => {
  const result = validateAutomationEligibility({
    ...basePayload,
    blast_radius: {
      max_allowed_scope: "organization",
      estimated_scope: "environment",
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(!result.eligibility.reason_codes.includes("blast_radius_exceeds_boundary"));
  }
});

test("gate 6: project-scope estimated exceeds environment max_allowed", () => {
  const result = validateAutomationEligibility({
    ...basePayload,
    blast_radius: {
      max_allowed_scope: "environment",
      estimated_scope: "project",
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.eligibility.eligible, false);
    assert.ok(result.eligibility.reason_codes.includes("blast_radius_exceeds_boundary"));
  }
});

test("missing blast_radius field fails schema validation", () => {
  const { blast_radius: _omit, ...rest } = basePayload;
  const result = validateAutomationEligibility(rest);
  assert.equal(result.ok, false);
});
