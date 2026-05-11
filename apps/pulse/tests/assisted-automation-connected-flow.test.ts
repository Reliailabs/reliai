import assert from "node:assert/strict";
import test from "node:test";

import {
  buildImpactPreview,
  emitEvidenceReceipt,
  validateAutomationEligibility,
  validateOperatorConfirmation,
} from "../lib/assisted-automation";

// ── Phase 9 connected flow: eligibility → impact preview → confirmation → receipt ──
//
// Validates the full proposal pipeline as specified in
// pulse-phase9-assisted-remediation-proposal-flow.md steps 2–6.
// All steps are validation-only — no execution, no persistence, no mutation.

const PROPOSAL_ID = "phase9-inc-abcdef1234567890";
const OPERATOR_EMAIL = "alice@example.com";
const OPERATOR_ID = "op_alice_001";
const TARGET_ID = "inc_abc123";
const EVIDENCE_REFS = [
  { label: "Trace compare", href: "/traces/compare/abc" },
  { label: "Linked deployment", href: "/deployments#dep_1" },
];

test("connected flow: eligibility passes all 6 gates and produces eligible=true", () => {
  const result = validateAutomationEligibility({
    proposal_id: PROPOSAL_ID,
    action_type: "open_remediation_task",
    target_type: "incident",
    target_id: TARGET_ID,
    request_context: {
      organization_id: "org_acme",
      project_id: "proj_payments",
      environment_id: "env_prod",
    },
    evidence_refs: EVIDENCE_REFS,
    signal_quality: { confidence: "high", evidence_density: "high" },
    safety: {
      has_rollback_path: true,
      has_safe_noop_fallback: true,
      policy_checks_passed: true,
      high_risk_environment: false,
    },
    approvals: { rbac_allows_approval: true, dual_approval_required: false },
    blast_radius: { max_allowed_scope: "environment", estimated_scope: "environment" },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.eligibility.eligible, true);
    assert.equal(result.eligibility.reason_codes.length, 0);
    assert.equal(result.eligibility.requires_operator_review, true);
  }
});

test("connected flow: impact preview produced from eligibility context", () => {
  const result = buildImpactPreview({
    proposal_id: PROPOSAL_ID,
    action_type: "open_remediation_task",
    target_type: "incident",
    target_id: TARGET_ID,
    step_type: "remediation_task_draft",
    environment_id: "env_prod",
    expected_effect: "Open remediation task to investigate payments regression.",
    reversibility_note: "Reversible — task can be cancelled before execution.",
    risk_flags: [],
    evidence_refs: EVIDENCE_REFS,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.preview.proposal_id, PROPOSAL_ID);
    assert.equal(result.preview.blast_radius.scope, "environment");
    assert.equal(result.preview.reversibility.reversible, true);
    assert.equal(result.preview.policy_decision_summary.result, "eligible");
    assert.equal(result.preview.requires_operator_review, true);
  }
});

test("connected flow: operator confirmation validates against previewed proposal", () => {
  const futureExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const confirmedAt = new Date().toISOString();

  const result = validateOperatorConfirmation({
    proposal_id: PROPOSAL_ID,
    operator_identity: { operator_email: OPERATOR_EMAIL, operator_id: OPERATOR_ID },
    target_summary: `Open remediation task for incident ${TARGET_ID} in env_prod`,
    evidence_refs: EVIDENCE_REFS,
    policy_result: "passed",
    reversibility_status: "reversible",
    confirmation_acknowledged: true,
    proposal_expires_at: futureExpiry,
    confirmed_at: confirmedAt,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.proposal_id, PROPOSAL_ID);
    assert.equal(result.data.operator_email, OPERATOR_EMAIL);
    assert.equal(result.data.confirmation_status, "confirmed");
    assert.equal(result.data.logged, true);
  }
});

test("connected flow: evidence receipt emitted after confirmation", () => {
  const createdAt = new Date().toISOString();

  const result = emitEvidenceReceipt({
    proposal_id: PROPOSAL_ID,
    actor_id: OPERATOR_ID,
    action_class: "open_remediation_task",
    target: { target_type: "incident", target_id: TARGET_ID },
    evidence_refs: EVIDENCE_REFS,
    policy_gate_result: "passed",
    created_at: createdAt,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.match(result.receipt.receipt_id, /^receipt-[0-9a-f]{16}$/);
    assert.equal(result.receipt.proposal_id, PROPOSAL_ID);
    assert.equal(result.receipt.actor_id, OPERATOR_ID);
    assert.equal(result.receipt.action_class, "open_remediation_task");
    assert.equal(result.receipt.target.target_id, TARGET_ID);
    assert.equal(result.receipt.policy_gate_result, "passed");
    assert.equal(result.receipt.immutable, true);
  }
});

test("connected flow: receipt_id is stable across identical confirmation events", () => {
  const createdAt = new Date().toISOString();
  const payload = {
    proposal_id: PROPOSAL_ID,
    actor_id: OPERATOR_ID,
    action_class: "open_remediation_task" as const,
    target: { target_type: "incident" as const, target_id: TARGET_ID },
    evidence_refs: EVIDENCE_REFS,
    policy_gate_result: "passed" as const,
    created_at: createdAt,
  };

  const r1 = emitEvidenceReceipt(payload);
  const r2 = emitEvidenceReceipt(payload);
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  if (r1.ok && r2.ok) {
    assert.equal(r1.receipt.receipt_id, r2.receipt.receipt_id);
  }
});

test("connected flow: policy-denied at eligibility blocks confirmation", () => {
  const futureExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Simulate: eligibility fails → policy_result must be "denied" → confirmation blocked
  const confirmResult = validateOperatorConfirmation({
    proposal_id: PROPOSAL_ID,
    operator_identity: { operator_email: OPERATOR_EMAIL, operator_id: OPERATOR_ID },
    target_summary: "Blocked proposal",
    evidence_refs: EVIDENCE_REFS,
    policy_result: "denied",
    reversibility_status: "reversible",
    confirmation_acknowledged: true,
    proposal_expires_at: futureExpiry,
    confirmed_at: new Date().toISOString(),
  });

  assert.equal(confirmResult.ok, false);
  if (!confirmResult.ok) {
    assert.match(confirmResult.errors.join(" "), /policy-denied/);
  }
});

test("connected flow: no execution fields present at any stage", () => {
  // Verify none of the pipeline outputs contain execution-related fields
  const eligibility = validateAutomationEligibility({
    proposal_id: PROPOSAL_ID,
    action_type: "open_remediation_task",
    target_type: "incident",
    target_id: TARGET_ID,
    request_context: { organization_id: "org_1", project_id: "proj_1", environment_id: "env_1" },
    evidence_refs: EVIDENCE_REFS,
    signal_quality: { confidence: "high", evidence_density: "high" },
    safety: { has_rollback_path: true, has_safe_noop_fallback: true, policy_checks_passed: true, high_risk_environment: false },
    approvals: { rbac_allows_approval: true, dual_approval_required: false },
    blast_radius: { max_allowed_scope: "environment", estimated_scope: "environment" },
  });

  assert.equal(eligibility.ok, true);
  if (eligibility.ok) {
    const e = eligibility.eligibility as Record<string, unknown>;
    assert.equal(e["execute"], undefined);
    assert.equal(e["execution_path"], undefined);
    assert.equal(e["rollback_command"], undefined);
    assert.equal(eligibility.eligibility.requires_operator_review, true);
  }
});
