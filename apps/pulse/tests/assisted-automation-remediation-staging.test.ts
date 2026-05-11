import assert from "node:assert/strict";
import test from "node:test";

import { PHASE9_VALIDATOR_RESPONSE_CONTRACT } from "../app/api/actions/assisted-automation/_response";
import { stageRemediationStep } from "../lib/assisted-automation";

const now = new Date("2026-05-11T12:00:00.000Z");
const recentStagedAt = new Date(now.getTime() - 5 * 60 * 1000).toISOString(); // 5 min ago
const expiredStagedAt = new Date(now.getTime() - 16 * 60 * 1000).toISOString(); // 16 min ago

const basePayload = {
  step_type: "rollback_candidate_command_set",
  target_id: "dep_abc123",
  staged_at: recentStagedAt,
  staged_environment_id: "production",
  active_environment_id: "production",
  evidence_refs: [
    { label: "Deployment", href: "/deployments/dep_abc123" },
    { label: "Incident", href: "/incidents/inc_1" },
  ],
  staging_metadata: {
    expected_effect: "Revert deployment dep_abc123 to previous stable version.",
    reversibility_note: "Rollback is reversible by re-deploying the same artifact.",
    risk_flags: [],
    approval_requirements: [],
  },
} as const;

// ── Valid requests ────────────────────────────────────────────────────────────

test("valid rollback_candidate_command_set stages successfully", () => {
  const result = stageRemediationStep(basePayload, now);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.staged_step.step_type, "rollback_candidate_command_set");
    assert.equal(result.staged_step.target_id, "dep_abc123");
    assert.equal(result.staged_step.staged_environment_id, "production");
  }
});

test("valid guardrail_update_proposal stages successfully", () => {
  const result = stageRemediationStep(
    { ...basePayload, step_type: "guardrail_update_proposal" },
    now,
  );
  assert.equal(result.ok, true);
});

test("valid remediation_task_draft stages successfully", () => {
  const result = stageRemediationStep(
    { ...basePayload, step_type: "remediation_task_draft" },
    now,
  );
  assert.equal(result.ok, true);
});

// ── TTL validation ────────────────────────────────────────────────────────────

test("expired staged_at is rejected", () => {
  const result = stageRemediationStep({ ...basePayload, staged_at: expiredStagedAt }, now);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /expired/);
  }
});

test("staged_at exactly at TTL boundary is rejected", () => {
  const atBoundary = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const result = stageRemediationStep({ ...basePayload, staged_at: atBoundary }, now);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /expired/);
  }
});

test("staged_at 1ms before TTL boundary is accepted", () => {
  const justBeforeTtl = new Date(now.getTime() - 15 * 60 * 1000 + 1).toISOString();
  const result = stageRemediationStep({ ...basePayload, staged_at: justBeforeTtl }, now);
  assert.equal(result.ok, true);
});

test("invalid staged_at format is rejected", () => {
  const result = stageRemediationStep({ ...basePayload, staged_at: "not-a-date" }, now);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /staged_at/);
  }
});

// ── Environment mismatch ──────────────────────────────────────────────────────

test("environment mismatch is rejected", () => {
  const result = stageRemediationStep(
    { ...basePayload, staged_environment_id: "staging", active_environment_id: "production" },
    now,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /environment mismatch/);
  }
});

test("matching environments are accepted", () => {
  const result = stageRemediationStep(
    { ...basePayload, staged_environment_id: "staging", active_environment_id: "staging" },
    now,
  );
  assert.equal(result.ok, true);
});

// ── Evidence refs ─────────────────────────────────────────────────────────────

test("external evidence href is rejected", () => {
  const result = stageRemediationStep(
    {
      ...basePayload,
      evidence_refs: [{ label: "External", href: "https://example.com" }],
    },
    now,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /non-internal href/);
  }
});

test("missing evidence_refs fails schema validation", () => {
  const { evidence_refs: _omit, ...rest } = basePayload;
  const result = stageRemediationStep(rest, now);
  assert.equal(result.ok, false);
});

test("evidence_refs are deep-copied in output", () => {
  const result = stageRemediationStep(basePayload, now);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.notEqual(result.staged_step.evidence_refs, basePayload.evidence_refs as unknown);
    assert.deepEqual(result.staged_step.evidence_refs, basePayload.evidence_refs);
  }
});

// ── Staging metadata ──────────────────────────────────────────────────────────

test("risk_flags emit warnings", () => {
  const result = stageRemediationStep(
    {
      ...basePayload,
      staging_metadata: {
        ...basePayload.staging_metadata,
        risk_flags: ["high_traffic_window", "incomplete_rollback_path"],
      },
    },
    now,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.warnings.some((w) => /risk flag/i.test(w)));
  }
});

test("approval_requirements emit warnings", () => {
  const result = stageRemediationStep(
    {
      ...basePayload,
      staging_metadata: {
        ...basePayload.staging_metadata,
        approval_requirements: ["senior-sre", "security-team"],
      },
    },
    now,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.warnings.some((w) => /approval/i.test(w)));
  }
});

test("no risk_flags or approval_requirements produces no warnings", () => {
  const result = stageRemediationStep(basePayload, now);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.warnings.length, 0);
  }
});

// ── Output shape ──────────────────────────────────────────────────────────────

test("expires_at is 15 minutes after staged_at", () => {
  const result = stageRemediationStep(basePayload, now);
  assert.equal(result.ok, true);
  if (result.ok) {
    const stagedMs = new Date(result.staged_step.staged_at).getTime();
    const expiresMs = new Date(result.staged_step.expires_at).getTime();
    assert.equal(expiresMs - stagedMs, 15 * 60 * 1000);
  }
});

test("output contains no execution, mutation, or persistence fields", () => {
  const result = stageRemediationStep(basePayload, now);
  assert.equal(result.ok, true);
  if (result.ok) {
    const s = result.staged_step as Record<string, unknown>;
    assert.equal(s["executed"], undefined);
    assert.equal(s["applied"], undefined);
    assert.equal(s["persisted"], undefined);
    assert.equal(s["rollback_executed"], undefined);
    assert.equal(s["approved"], undefined);
  }
});

test("invalid step_type is rejected", () => {
  const result = stageRemediationStep({ ...basePayload, step_type: "auto_rollback" }, now);
  assert.equal(result.ok, false);
});

// ── Phase 9 envelope ──────────────────────────────────────────────────────────

test("phase 9 envelope contract is validation-only and execution_granted is false", () => {
  assert.equal(PHASE9_VALIDATOR_RESPONSE_CONTRACT.contract_version, "phase9-v1");
  assert.equal(PHASE9_VALIDATOR_RESPONSE_CONTRACT.mode, "validation_only");
  assert.equal(PHASE9_VALIDATOR_RESPONSE_CONTRACT.execution_granted, false);
});

// ── Multiple errors ───────────────────────────────────────────────────────────

test("expired TTL and environment mismatch both reported together", () => {
  const result = stageRemediationStep(
    {
      ...basePayload,
      staged_at: expiredStagedAt,
      staged_environment_id: "staging",
      active_environment_id: "production",
    },
    now,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((e) => /expired/.test(e)));
    assert.ok(result.errors.some((e) => /environment mismatch/.test(e)));
  }
});
