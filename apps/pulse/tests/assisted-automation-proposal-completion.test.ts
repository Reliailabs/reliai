import assert from "node:assert/strict";
import test from "node:test";

import { PHASE9_VALIDATOR_RESPONSE_CONTRACT } from "../app/api/actions/assisted-automation/_response";
import {
  buildImpactPreview,
  emitEvidenceReceipt,
  validateOperatorConfirmation,
} from "../lib/assisted-automation";

// ── buildImpactPreview ────────────────────────────────────────────────────────

const basePreviewPayload = {
  proposal_id: "phase9-inc-abcdef1234567890",
  action_type: "rollback" as const,
  target_type: "incident" as const,
  target_id: "inc_abc123",
  step_type: "rollback_candidate_command_set" as const,
  environment_id: "env_prod",
  expected_effect: "Revert payments-api to previous stable build.",
  reversibility_note: "Reversible — previous build artifact retained for 30 days.",
  risk_flags: [],
  evidence_refs: [
    { label: "Trace compare", href: "/traces/compare/abc" },
    { label: "Deployment", href: "/deployments#dep_1" },
  ],
};

test("buildImpactPreview: valid request returns preview with all required fields", () => {
  const result = buildImpactPreview(basePreviewPayload);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.preview.proposal_id, basePreviewPayload.proposal_id);
    assert.ok(result.preview.command_preview.length > 0);
    assert.ok(result.preview.blast_radius.scope.length > 0);
    assert.ok(result.preview.blast_radius.risk_level.length > 0);
    assert.equal(result.preview.reversibility.reversible, true);
    assert.ok(result.preview.policy_decision_summary.gates_evaluated.length > 0);
    assert.equal(result.preview.policy_decision_summary.result, "eligible");
    assert.equal(result.preview.requires_operator_review, true);
  }
});

test("buildImpactPreview: rollback action produces high risk level", () => {
  const result = buildImpactPreview(basePreviewPayload);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.preview.blast_radius.risk_level, "high");
  }
});

test("buildImpactPreview: ack action with no risk flags produces low risk level", () => {
  const result = buildImpactPreview({ ...basePreviewPayload, action_type: "ack", risk_flags: [] });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.preview.blast_radius.risk_level, "low");
  }
});

test("buildImpactPreview: guardrail_policy target maps to organization scope", () => {
  const result = buildImpactPreview({
    ...basePreviewPayload,
    target_type: "guardrail_policy",
    action_type: "propose_guardrail",
    step_type: "guardrail_update_proposal",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.preview.blast_radius.scope, "organization");
  }
});

test("buildImpactPreview: trace_group target maps to project scope", () => {
  const result = buildImpactPreview({ ...basePreviewPayload, target_type: "trace_group" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.preview.blast_radius.scope, "project");
  }
});

test("buildImpactPreview: incident target maps to environment scope", () => {
  const result = buildImpactPreview(basePreviewPayload);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.preview.blast_radius.scope, "environment");
  }
});

test("buildImpactPreview: irreversible reversibility_note sets reversible=false and emits warning", () => {
  const result = buildImpactPreview({
    ...basePreviewPayload,
    reversibility_note: "This action is irreversible — no rollback path available.",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.preview.reversibility.reversible, false);
    assert.ok(result.warnings.some((w) => /irreversible/i.test(w)));
  }
});

test("buildImpactPreview: high risk action emits dual-review warning", () => {
  const result = buildImpactPreview(basePreviewPayload);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.warnings.some((w) => /dual operator review/i.test(w)));
  }
});

test("buildImpactPreview: two or more risk flags elevate to high risk", () => {
  const result = buildImpactPreview({
    ...basePreviewPayload,
    action_type: "assign",
    risk_flags: ["flag_a", "flag_b"],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.preview.blast_radius.risk_level, "high");
  }
});

test("buildImpactPreview: external evidence href is rejected", () => {
  const result = buildImpactPreview({
    ...basePreviewPayload,
    evidence_refs: [{ label: "External", href: "https://example.com" }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /non-internal href/);
  }
});

test("buildImpactPreview: invalid proposal_id format is rejected", () => {
  const result = buildImpactPreview({ ...basePreviewPayload, proposal_id: "bad-id" });
  assert.equal(result.ok, false);
});

test("buildImpactPreview: evidence_refs are a copy, not a reference alias", () => {
  const result = buildImpactPreview(basePreviewPayload);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.notEqual(result.preview.evidence_refs, basePreviewPayload.evidence_refs as unknown);
    assert.deepEqual(result.preview.evidence_refs, basePreviewPayload.evidence_refs);
  }
});

// ── validateOperatorConfirmation ──────────────────────────────────────────────

const futureExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
const confirmedNow = new Date().toISOString();

const baseConfirmPayload = {
  proposal_id: "phase9-inc-abcdef1234567890",
  operator_identity: {
    operator_email: "alice@example.com",
    operator_id: "op_alice_001",
  },
  target_summary: "Rollback payments-api v2.3.1 to v2.2.9",
  evidence_refs: [{ label: "Trace", href: "/traces/abc" }],
  policy_result: "passed" as const,
  reversibility_status: "reversible" as const,
  confirmation_acknowledged: true,
  proposal_expires_at: futureExpiry,
  confirmed_at: confirmedNow,
};

test("validateOperatorConfirmation: valid confirmation returns confirmed status", () => {
  const result = validateOperatorConfirmation(baseConfirmPayload);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.confirmation_status, "confirmed");
    assert.equal(result.data.operator_email, "alice@example.com");
    assert.equal(result.data.proposal_id, baseConfirmPayload.proposal_id);
    assert.equal(result.data.logged, true);
  }
});

test("validateOperatorConfirmation: confirmation_acknowledged=false is rejected", () => {
  const result = validateOperatorConfirmation({ ...baseConfirmPayload, confirmation_acknowledged: false });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /implicit approval is not permitted/);
  }
});

test("validateOperatorConfirmation: expired proposal is rejected", () => {
  const expired = new Date(Date.now() - 1000).toISOString();
  const result = validateOperatorConfirmation({
    ...baseConfirmPayload,
    proposal_expires_at: expired,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /expired/);
  }
});

test("validateOperatorConfirmation: policy_result=denied blocks confirmation", () => {
  const result = validateOperatorConfirmation({ ...baseConfirmPayload, policy_result: "denied" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /policy-denied/);
  }
});

test("validateOperatorConfirmation: irreversible status emits warning", () => {
  const result = validateOperatorConfirmation({
    ...baseConfirmPayload,
    reversibility_status: "irreversible",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.warnings.some((w) => /irreversible/i.test(w)));
  }
});

test("validateOperatorConfirmation: partially_reversible status emits warning", () => {
  const result = validateOperatorConfirmation({
    ...baseConfirmPayload,
    reversibility_status: "partially_reversible",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.warnings.some((w) => /partially reversible/i.test(w)));
  }
});

test("validateOperatorConfirmation: external evidence href is rejected", () => {
  const result = validateOperatorConfirmation({
    ...baseConfirmPayload,
    evidence_refs: [{ label: "Ext", href: "https://evil.com" }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /non-internal href/);
  }
});

test("validateOperatorConfirmation: invalid proposal_id format is rejected", () => {
  const result = validateOperatorConfirmation({ ...baseConfirmPayload, proposal_id: "not-a-phase9-id" });
  assert.equal(result.ok, false);
});

test("validateOperatorConfirmation: missing operator_identity fails schema", () => {
  const { operator_identity: _omit, ...rest } = baseConfirmPayload;
  const result = validateOperatorConfirmation(rest);
  assert.equal(result.ok, false);
});

// ── emitEvidenceReceipt ───────────────────────────────────────────────────────

const baseReceiptPayload = {
  proposal_id: "phase9-inc-abcdef1234567890",
  actor_id: "op_alice_001",
  action_class: "rollback" as const,
  target: {
    target_type: "incident" as const,
    target_id: "inc_abc123",
  },
  evidence_refs: [
    { label: "Trace compare", href: "/traces/compare/abc" },
    { label: "Deployment", href: "/deployments#dep_1" },
  ],
  policy_gate_result: "passed" as const,
  created_at: new Date().toISOString(),
};

test("emitEvidenceReceipt: valid payload returns receipt with all 8 required fields", () => {
  const result = emitEvidenceReceipt(baseReceiptPayload);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.match(result.receipt.receipt_id, /^receipt-[0-9a-f]{16}$/);
    assert.equal(result.receipt.proposal_id, baseReceiptPayload.proposal_id);
    assert.equal(result.receipt.actor_id, baseReceiptPayload.actor_id);
    assert.equal(result.receipt.action_class, baseReceiptPayload.action_class);
    assert.deepEqual(result.receipt.target, baseReceiptPayload.target);
    assert.equal(result.receipt.evidence_refs.length, 2);
    assert.equal(result.receipt.policy_gate_result, "passed");
    assert.equal(result.receipt.created_at, baseReceiptPayload.created_at);
    assert.equal(result.receipt.immutable, true);
  }
});

test("emitEvidenceReceipt: receipt_id is deterministic for same inputs", () => {
  const r1 = emitEvidenceReceipt(baseReceiptPayload);
  const r2 = emitEvidenceReceipt(baseReceiptPayload);
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  if (r1.ok && r2.ok) {
    assert.equal(r1.receipt.receipt_id, r2.receipt.receipt_id);
  }
});

test("emitEvidenceReceipt: different proposal_id produces different receipt_id", () => {
  const r1 = emitEvidenceReceipt(baseReceiptPayload);
  const r2 = emitEvidenceReceipt({ ...baseReceiptPayload, proposal_id: "phase9-inc-0000000000000000" });
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  if (r1.ok && r2.ok) {
    assert.notEqual(r1.receipt.receipt_id, r2.receipt.receipt_id);
  }
});

test("emitEvidenceReceipt: policy_gate_result=denied emits warning, not error", () => {
  const result = emitEvidenceReceipt({ ...baseReceiptPayload, policy_gate_result: "denied" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.receipt.policy_gate_result, "denied");
    assert.ok(result.warnings.some((w) => /denial/i.test(w)));
  }
});

test("emitEvidenceReceipt: external evidence href is rejected", () => {
  const result = emitEvidenceReceipt({
    ...baseReceiptPayload,
    evidence_refs: [{ label: "Ext", href: "https://example.com" }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /non-internal href/);
  }
});

test("emitEvidenceReceipt: evidence_refs are a copy, not a reference alias", () => {
  const result = emitEvidenceReceipt(baseReceiptPayload);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.notEqual(result.receipt.evidence_refs, baseReceiptPayload.evidence_refs as unknown);
    assert.deepEqual(result.receipt.evidence_refs, baseReceiptPayload.evidence_refs);
  }
});

test("emitEvidenceReceipt: missing actor_id fails schema", () => {
  const { actor_id: _omit, ...rest } = baseReceiptPayload;
  const result = emitEvidenceReceipt(rest);
  assert.equal(result.ok, false);
});

// ── Phase 9 envelope contract ─────────────────────────────────────────────────

test("phase 9 envelope contract is preserved", () => {
  assert.equal(PHASE9_VALIDATOR_RESPONSE_CONTRACT.contract_version, "phase9-v1");
  assert.equal(PHASE9_VALIDATOR_RESPONSE_CONTRACT.execution_granted, false);
});
