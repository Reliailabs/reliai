import assert from "node:assert/strict";
import test from "node:test";

import { PHASE9_VALIDATOR_RESPONSE_CONTRACT } from "../app/api/actions/assisted-automation/_response";
import {
  validateAutomationAuditEvent,
  validateKillSwitchPolicy,
  validateObservabilityPayload,
} from "../lib/assisted-automation";

// ── Audit event fixtures ──────────────────────────────────────────────────────

const baseAuditEvent = {
  event_id: "evt_001",
  actor: { type: "human", id: "operator@example.com" },
  suggestion_generated: {
    proposal_id: "phase9-inc-abcdef1234567890",
    step_type: "open_remediation_task",
    surface: "incidents",
  },
  evidence_basis: [
    { label: "Trace compare", href: "/traces/compare/abc" },
    { label: "Deployment", href: "/deployments/dep_1" },
  ],
  operator_decision: { decision: "accepted" },
  outcome_status: "completed",
  timestamps: {
    proposed_at: "2026-05-11T10:00:00.000Z",
    decided_at: "2026-05-11T10:05:00.000Z",
  },
} as const;

// ── Audit: valid events ───────────────────────────────────────────────────────

test("valid audit event with human actor passes", () => {
  const result = validateAutomationAuditEvent(baseAuditEvent);
  assert.equal(result.ok, true);
});

test("valid audit event with system actor passes", () => {
  const result = validateAutomationAuditEvent({
    ...baseAuditEvent,
    actor: { type: "system", id: "automation-engine" },
  });
  assert.equal(result.ok, true);
});

test("all three surfaces are accepted", () => {
  for (const surface of ["incidents", "deployments", "guardrails"] as const) {
    const result = validateAutomationAuditEvent({
      ...baseAuditEvent,
      suggestion_generated: { ...baseAuditEvent.suggestion_generated, surface },
    });
    assert.equal(result.ok, true, `surface '${surface}' should be accepted`);
  }
});

test("optional completed_at is accepted", () => {
  const result = validateAutomationAuditEvent({
    ...baseAuditEvent,
    timestamps: { ...baseAuditEvent.timestamps, completed_at: "2026-05-11T10:06:00.000Z" },
  });
  assert.equal(result.ok, true);
});

// ── Audit: timestamp invariants ───────────────────────────────────────────────

test("decided_at before proposed_at is rejected", () => {
  const result = validateAutomationAuditEvent({
    ...baseAuditEvent,
    timestamps: {
      proposed_at: "2026-05-11T10:05:00.000Z",
      decided_at: "2026-05-11T10:00:00.000Z",
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /decided_at must not precede/);
  }
});

test("decided_at equal to proposed_at is accepted", () => {
  const result = validateAutomationAuditEvent({
    ...baseAuditEvent,
    timestamps: {
      proposed_at: "2026-05-11T10:00:00.000Z",
      decided_at: "2026-05-11T10:00:00.000Z",
    },
  });
  assert.equal(result.ok, true);
});

// ── Audit: evidence and decisions ─────────────────────────────────────────────

test("external evidence_basis href is rejected", () => {
  const result = validateAutomationAuditEvent({
    ...baseAuditEvent,
    evidence_basis: [{ label: "External", href: "https://example.com" }],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /non-internal href/);
  }
});

test("rejected decision without reason emits warning", () => {
  const result = validateAutomationAuditEvent({
    ...baseAuditEvent,
    operator_decision: { decision: "rejected" },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.warnings.some((w) => /rejection reason/i.test(w)));
  }
});

test("rejected decision with reason has no warnings", () => {
  const result = validateAutomationAuditEvent({
    ...baseAuditEvent,
    operator_decision: { decision: "rejected", reason: "Not appropriate for this incident." },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.warnings.length, 0);
  }
});

test("disabled_by_policy outcome_status is valid", () => {
  const result = validateAutomationAuditEvent({
    ...baseAuditEvent,
    operator_decision: { decision: "disabled_by_policy" },
    outcome_status: "disabled_by_policy",
  });
  assert.equal(result.ok, true);
});

// ── Kill-switch: no switches active ──────────────────────────────────────────

const baseKillSwitchPolicy = {
  organization_id: "org_1",
  global_kill_switch_active: false,
  surface_kill_switches: { incidents: false, deployments: false, guardrails: false },
  target_surface: "incidents",
  staged_proposal_ids: [],
} as const;

test("no kill-switches active — allowed is true", () => {
  const result = validateKillSwitchPolicy(baseKillSwitchPolicy);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.allowed, true);
    assert.equal(result.block_reason, null);
    assert.equal(result.disabled_proposal_ids.length, 0);
  }
});

// ── Kill-switch: global ───────────────────────────────────────────────────────

test("global kill-switch blocks all surfaces", () => {
  for (const surface of ["incidents", "deployments", "guardrails"] as const) {
    const result = validateKillSwitchPolicy({
      ...baseKillSwitchPolicy,
      global_kill_switch_active: true,
      target_surface: surface,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.allowed, false);
      assert.match(result.block_reason ?? "", /global kill-switch/);
    }
  }
});

test("global kill-switch marks staged proposals disabled_by_policy", () => {
  const result = validateKillSwitchPolicy({
    ...baseKillSwitchPolicy,
    global_kill_switch_active: true,
    staged_proposal_ids: ["phase9-inc-aaa", "phase9-inc-bbb"],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.disabled_proposal_ids, ["phase9-inc-aaa", "phase9-inc-bbb"]);
    assert.ok(result.warnings.some((w) => /disabled_by_policy/.test(w)));
  }
});

// ── Kill-switch: per-surface ──────────────────────────────────────────────────

test("surface kill-switch blocks only the targeted surface", () => {
  const result = validateKillSwitchPolicy({
    ...baseKillSwitchPolicy,
    surface_kill_switches: { incidents: true, deployments: false, guardrails: false },
    target_surface: "incidents",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.allowed, false);
    assert.match(result.block_reason ?? "", /incidents/);
  }
});

test("surface kill-switch for incidents does not block deployments", () => {
  const result = validateKillSwitchPolicy({
    ...baseKillSwitchPolicy,
    surface_kill_switches: { incidents: true, deployments: false, guardrails: false },
    target_surface: "deployments",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.allowed, true);
  }
});

test("no staged proposals disabled when kill-switch is off", () => {
  const result = validateKillSwitchPolicy({
    ...baseKillSwitchPolicy,
    staged_proposal_ids: ["phase9-inc-aaa"],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.disabled_proposal_ids.length, 0);
  }
});

// ── Observability ─────────────────────────────────────────────────────────────

const baseObservability = {
  organization_id: "org_1",
  window_start: "2026-05-11T00:00:00.000Z",
  window_end: "2026-05-11T23:59:59.000Z",
  decision_outcomes: { accepted: 10, rejected: 3, deferred: 2, disabled_by_policy: 1 },
  block_reason_distribution: [
    { reason: "insufficient_confidence", count: 5 },
    { reason: "rbac_denied", count: 2 },
  ],
  operator_override_frequency: 0.2,
} as const;

test("valid observability payload passes", () => {
  const result = validateObservabilityPayload(baseObservability);
  assert.equal(result.ok, true);
});

test("window_end before window_start is rejected", () => {
  const result = validateObservabilityPayload({
    ...baseObservability,
    window_start: "2026-05-11T23:59:59.000Z",
    window_end: "2026-05-11T00:00:00.000Z",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /window_end must be after/);
  }
});

test("window_end equal to window_start is rejected", () => {
  const result = validateObservabilityPayload({
    ...baseObservability,
    window_start: "2026-05-11T12:00:00.000Z",
    window_end: "2026-05-11T12:00:00.000Z",
  });
  assert.equal(result.ok, false);
});

test("zero total decisions emits warning", () => {
  const result = validateObservabilityPayload({
    ...baseObservability,
    decision_outcomes: { accepted: 0, rejected: 0, deferred: 0, disabled_by_policy: 0 },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.warnings.some((w) => /no automation decisions/i.test(w)));
  }
});

test("high operator override frequency emits warning", () => {
  const result = validateObservabilityPayload({
    ...baseObservability,
    operator_override_frequency: 0.75,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.warnings.some((w) => /override frequency/i.test(w)));
  }
});

test("override frequency above 1.0 is rejected by schema", () => {
  const result = validateObservabilityPayload({
    ...baseObservability,
    operator_override_frequency: 1.1,
  });
  assert.equal(result.ok, false);
});

test("empty block_reason_distribution is valid", () => {
  const result = validateObservabilityPayload({
    ...baseObservability,
    block_reason_distribution: [],
  });
  assert.equal(result.ok, true);
});

// ── Phase 9 envelope ──────────────────────────────────────────────────────────

test("phase 9 envelope is validation-only and execution_granted is false", () => {
  assert.equal(PHASE9_VALIDATOR_RESPONSE_CONTRACT.contract_version, "phase9-v1");
  assert.equal(PHASE9_VALIDATOR_RESPONSE_CONTRACT.mode, "validation_only");
  assert.equal(PHASE9_VALIDATOR_RESPONSE_CONTRACT.execution_granted, false);
});
