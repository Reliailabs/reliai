import assert from "node:assert/strict";
import test from "node:test";

import {
  canConcludeMitigation,
  deriveReplayHealth,
  evaluateMitigationConclusionIntegrity,
  getOperationalDecisionEvidenceRequirements,
  getOperationalDecisionEvidenceSummary,
  getOperationalDecisionOutcomeMessage,
  getMitigationOutcomeMessage,
  getReplayHealthLabel,
  deriveScenarioHealth,
  getMitigationConclusionDecision,
  getOperationalConclusionBlockMessage,
  getReplayHealthPolicy,
  getScenarioHealthLabel,
  getScenarioHealthPolicy,
} from "../lib/demo-operational-integrity-contract";

test("replay health policy: healthy allows conclusions", () => {
  const policy = getReplayHealthPolicy("healthy");
  assert.equal(policy.trust_level, "high");
  assert.equal(policy.allow_conclusion, true);
  assert.match(policy.evidence_note, /complete/i);
});

test("replay health policy: partial and stale degrade confidence", () => {
  const partial = getReplayHealthPolicy("partial");
  const stale = getReplayHealthPolicy("stale");

  assert.equal(partial.allow_conclusion, false);
  assert.equal(stale.allow_conclusion, false);
  assert.equal(partial.trust_level, "degraded");
  assert.equal(stale.trust_level, "degraded");
});

test("replay health policy: unknown blocks trustworthy conclusions", () => {
  const unknown = getReplayHealthPolicy("unknown");
  assert.equal(unknown.trust_level, "low");
  assert.equal(unknown.allow_conclusion, false);
  assert.match(unknown.evidence_note, /not trustworthy|unknown/i);
});

test("scenario health policy: healthy allows conclusions", () => {
  const policy = getScenarioHealthPolicy("healthy");
  assert.equal(policy.trust_level, "high");
  assert.equal(policy.allow_conclusion, true);
});

test("scenario health policy: stale and partial degrade conclusions", () => {
  const stale = getScenarioHealthPolicy("stale");
  const partial = getScenarioHealthPolicy("partial");
  assert.equal(stale.allow_conclusion, false);
  assert.equal(partial.allow_conclusion, false);
});

test("scenario health policy: unknown is low trust", () => {
  const unknown = getScenarioHealthPolicy("unknown");
  assert.equal(unknown.trust_level, "low");
  assert.equal(unknown.allow_conclusion, false);
});

test("derivers map fixture profiles to health states", () => {
  assert.equal(
    deriveReplayHealth({ stale: false, partial: false, unknown_outcome: false }),
    "healthy",
  );
  assert.equal(
    deriveReplayHealth({ stale: false, partial: true, unknown_outcome: false }),
    "partial",
  );
  assert.equal(
    deriveScenarioHealth({
      stale_mitigation: true,
      partial_evidence: false,
      unknown_outcome: false,
    }),
    "stale",
  );
  assert.equal(
    deriveScenarioHealth({
      stale_mitigation: false,
      partial_evidence: false,
      unknown_outcome: true,
    }),
    "unknown",
  );
});

test("mitigation conclusions require both replay and scenario health to allow conclusions", () => {
  assert.equal(canConcludeMitigation(true, "healthy", "healthy"), true);
  assert.equal(canConcludeMitigation(true, "partial", "healthy"), false);
  assert.equal(canConcludeMitigation(true, "healthy", "partial"), false);
  assert.equal(canConcludeMitigation(true, "unknown", "healthy"), false);
  assert.equal(canConcludeMitigation(true, "healthy", "unknown"), false);
  assert.equal(canConcludeMitigation(true, "unknown", "unknown"), false);
  assert.equal(canConcludeMitigation(false, "healthy", "healthy"), false);
});

test("mitigation conclusion decision returns deterministic block reasons", () => {
  assert.deepEqual(getMitigationConclusionDecision(true, "healthy", "healthy"), {
    allowed: true,
    block_reason: "none",
  });
  assert.deepEqual(getMitigationConclusionDecision(true, "unknown", "healthy"), {
    allowed: false,
    block_reason: "replay_health_not_trustworthy",
  });
  assert.deepEqual(getMitigationConclusionDecision(true, "healthy", "partial"), {
    allowed: false,
    block_reason: "scenario_health_not_trustworthy",
  });
  assert.deepEqual(getMitigationConclusionDecision(true, "stale", "unknown"), {
    allowed: false,
    block_reason: "both_health_dimensions_not_trustworthy",
  });
  assert.deepEqual(getMitigationConclusionDecision(false, "healthy", "healthy"), {
    allowed: false,
    block_reason: "replay_not_complete",
  });
});

test("mitigation messaging helpers are deterministic by conclusion decision", () => {
  const allowed = getMitigationConclusionDecision(true, "healthy", "healthy");
  assert.equal(getMitigationOutcomeMessage(allowed), "Mitigation outcome available.");
  assert.equal(getOperationalConclusionBlockMessage(allowed), null);

  const notComplete = getMitigationConclusionDecision(false, "healthy", "healthy");
  assert.equal(
    getMitigationOutcomeMessage(notComplete),
    "Mitigation confidence pending replay integrity.",
  );
  assert.equal(getOperationalConclusionBlockMessage(notComplete), "replay not complete");

  const unknownReplay = getMitigationConclusionDecision(true, "unknown", "healthy");
  assert.equal(getOperationalConclusionBlockMessage(unknownReplay), "replay health not trustworthy");

  const partialScenario = getMitigationConclusionDecision(true, "healthy", "partial");
  assert.equal(
    getOperationalConclusionBlockMessage(partialScenario),
    "scenario health not trustworthy",
  );

  const staleReplay = getMitigationConclusionDecision(true, "stale", "healthy");
  assert.equal(getOperationalConclusionBlockMessage(staleReplay), "replay health not trustworthy");
});

test("health label helpers map replay/scenario states deterministically", () => {
  assert.equal(getReplayHealthLabel("healthy"), "Replay health: healthy");
  assert.equal(getReplayHealthLabel("stale"), "Replay health: stale snapshot");
  assert.equal(getReplayHealthLabel("partial"), "Replay health: partial evidence");
  assert.equal(getReplayHealthLabel("unknown"), "Replay health: unknown outcome");

  assert.equal(getScenarioHealthLabel("healthy"), "Scenario health: healthy");
  assert.equal(getScenarioHealthLabel("stale"), "Scenario health: stale mitigation");
  assert.equal(getScenarioHealthLabel("partial"), "Scenario health: partial evidence");
  assert.equal(getScenarioHealthLabel("unknown"), "Scenario health: unknown outcome");
});

test("operational decision integrity: healthy + complete evidence allows high-confidence conclusion", () => {
  const result = evaluateMitigationConclusionIntegrity({
    replay_done: true,
    replay_health: "healthy",
    scenario_health: "healthy",
    mitigation_evidence_exists: true,
    rollback_evidence_exists: true,
    causal_chain_complete: true,
    severity_evidence_aligned: true,
    arei_delta_linked_to_mitigation: true,
  });

  assert.deepEqual(result, {
    decision_allowed: true,
    policy_reasons: [],
    confidence_level: "high",
  });
});

test("operational decision integrity: missing mitigation evidence blocks conclusion", () => {
  const result = evaluateMitigationConclusionIntegrity({
    replay_done: true,
    replay_health: "healthy",
    scenario_health: "healthy",
    mitigation_evidence_exists: false,
    rollback_evidence_exists: true,
    causal_chain_complete: true,
    severity_evidence_aligned: true,
    arei_delta_linked_to_mitigation: true,
  });
  assert.equal(result.decision_allowed, false);
  assert.equal(result.confidence_level, "low");
  assert.deepEqual(result.policy_reasons, ["mitigation_evidence_missing"]);
});

test("operational decision integrity: missing rollback evidence blocks conclusion", () => {
  const result = evaluateMitigationConclusionIntegrity({
    replay_done: true,
    replay_health: "healthy",
    scenario_health: "healthy",
    mitigation_evidence_exists: true,
    rollback_evidence_exists: false,
    causal_chain_complete: true,
    severity_evidence_aligned: true,
    arei_delta_linked_to_mitigation: true,
  });
  assert.equal(result.decision_allowed, false);
  assert.equal(result.confidence_level, "low");
  assert.deepEqual(result.policy_reasons, ["rollback_evidence_missing"]);
});

test("operational decision integrity: incomplete causal chain blocks conclusion", () => {
  const result = evaluateMitigationConclusionIntegrity({
    replay_done: true,
    replay_health: "healthy",
    scenario_health: "healthy",
    mitigation_evidence_exists: true,
    rollback_evidence_exists: true,
    causal_chain_complete: false,
    severity_evidence_aligned: true,
    arei_delta_linked_to_mitigation: true,
  });
  assert.equal(result.decision_allowed, false);
  assert.equal(result.confidence_level, "low");
  assert.deepEqual(result.policy_reasons, ["causal_chain_incomplete"]);
});

test("operational decision integrity: severity/evidence mismatch blocks conclusion", () => {
  const result = evaluateMitigationConclusionIntegrity({
    replay_done: true,
    replay_health: "healthy",
    scenario_health: "healthy",
    mitigation_evidence_exists: true,
    rollback_evidence_exists: true,
    causal_chain_complete: true,
    severity_evidence_aligned: false,
    arei_delta_linked_to_mitigation: true,
  });
  assert.equal(result.decision_allowed, false);
  assert.equal(result.confidence_level, "low");
  assert.deepEqual(result.policy_reasons, ["severity_evidence_mismatch"]);
});

test("operational decision integrity: unlinked AREI delta blocks conclusion", () => {
  const result = evaluateMitigationConclusionIntegrity({
    replay_done: true,
    replay_health: "healthy",
    scenario_health: "healthy",
    mitigation_evidence_exists: true,
    rollback_evidence_exists: true,
    causal_chain_complete: true,
    severity_evidence_aligned: true,
    arei_delta_linked_to_mitigation: false,
  });
  assert.equal(result.decision_allowed, false);
  assert.equal(result.confidence_level, "low");
  assert.deepEqual(result.policy_reasons, ["arei_delta_unlinked_to_mitigation"]);
});

test("operational decision integrity: degraded health can be allowed with degraded confidence when configured", () => {
  const result = evaluateMitigationConclusionIntegrity({
    replay_done: true,
    replay_health: "stale",
    scenario_health: "partial",
    mitigation_evidence_exists: true,
    rollback_evidence_exists: true,
    causal_chain_complete: true,
    severity_evidence_aligned: true,
    arei_delta_linked_to_mitigation: true,
    allow_degraded_integrity_conclusion: true,
  });

  assert.deepEqual(result, {
    decision_allowed: true,
    policy_reasons: ["replay_integrity_untrusted", "scenario_integrity_untrusted"],
    confidence_level: "degraded",
  });
});

test("operational decision integrity: multiple failures return all reasons deterministically", () => {
  const result = evaluateMitigationConclusionIntegrity({
    replay_done: false,
    replay_health: "unknown",
    scenario_health: "partial",
    mitigation_evidence_exists: false,
    rollback_evidence_exists: false,
    causal_chain_complete: false,
    severity_evidence_aligned: false,
    arei_delta_linked_to_mitigation: false,
  });

  assert.equal(result.decision_allowed, false);
  assert.equal(result.confidence_level, "low");
  assert.deepEqual(result.policy_reasons, [
    "replay_not_complete",
    "replay_integrity_untrusted",
    "scenario_integrity_untrusted",
    "mitigation_evidence_missing",
    "rollback_evidence_missing",
    "causal_chain_incomplete",
    "severity_evidence_mismatch",
    "arei_delta_unlinked_to_mitigation",
  ]);
});

test("operational decision evidence requirements: deterministic checklist order and blocking flags", () => {
  const requirements = getOperationalDecisionEvidenceRequirements({
    replay_done: false,
    replay_health: "unknown",
    scenario_health: "partial",
    mitigation_evidence_exists: false,
    rollback_evidence_exists: true,
    causal_chain_complete: false,
    severity_evidence_aligned: false,
    arei_delta_linked_to_mitigation: true,
  });

  assert.deepEqual(
    requirements.map((item) => item.id),
    [
      "replay_completed",
      "replay_integrity_trusted",
      "scenario_integrity_trusted",
      "mitigation_evidence_present",
      "rollback_evidence_present",
      "causal_chain_complete",
      "severity_aligned_with_evidence",
      "arei_linked_to_mitigation",
    ],
  );
  assert.deepEqual(
    requirements.filter((item) => item.blocking).map((item) => item.id),
    [
      "replay_completed",
      "replay_integrity_trusted",
      "scenario_integrity_trusted",
      "mitigation_evidence_present",
      "causal_chain_complete",
      "severity_aligned_with_evidence",
    ],
  );
  assert.equal(
    requirements.find((item) => item.id === "rollback_evidence_present")?.satisfied,
    true,
  );
});

test("operational decision evidence requirements: blocking checklist items map to policy reasons", () => {
  const input = {
    replay_done: false,
    replay_health: "partial" as const,
    scenario_health: "stale" as const,
    mitigation_evidence_exists: false,
    rollback_evidence_exists: false,
    causal_chain_complete: false,
    severity_evidence_aligned: false,
    arei_delta_linked_to_mitigation: false,
  };

  const requirements = getOperationalDecisionEvidenceRequirements(input);
  const result = evaluateMitigationConclusionIntegrity(input);

  const requirementToReason = {
    replay_completed: "replay_not_complete",
    replay_integrity_trusted: "replay_integrity_untrusted",
    scenario_integrity_trusted: "scenario_integrity_untrusted",
    mitigation_evidence_present: "mitigation_evidence_missing",
    rollback_evidence_present: "rollback_evidence_missing",
    causal_chain_complete: "causal_chain_incomplete",
    severity_aligned_with_evidence: "severity_evidence_mismatch",
    arei_linked_to_mitigation: "arei_delta_unlinked_to_mitigation",
  } as const;

  for (const requirement of requirements) {
    const expectedReason = requirementToReason[requirement.id];
    const hasReason = result.policy_reasons.includes(expectedReason);
    assert.equal(
      hasReason,
      requirement.blocking,
      `Requirement '${requirement.id}' blocking state must match policy reason presence`,
    );
  }
});

test("operational decision evidence summary: derived from policy reasons and requirement states", () => {
  const input = {
    replay_done: false,
    replay_health: "unknown" as const,
    scenario_health: "partial" as const,
    mitigation_evidence_exists: false,
    rollback_evidence_exists: true,
    causal_chain_complete: false,
    severity_evidence_aligned: false,
    arei_delta_linked_to_mitigation: true,
  };

  const summary = getOperationalDecisionEvidenceSummary(input);
  assert.equal(summary.total_requirements, 8);
  assert.equal(summary.satisfied_requirements, 2);
  assert.equal(summary.blocking_requirements, 6);
  assert.deepEqual(summary.blocking_reasons, [
    "replay_not_complete",
    "replay_integrity_untrusted",
    "scenario_integrity_untrusted",
    "mitigation_evidence_missing",
    "causal_chain_incomplete",
    "severity_evidence_mismatch",
  ]);
  assert.deepEqual(summary.blocking_reason_messages, [
    "replay not complete",
    "replay integrity untrusted",
    "scenario integrity untrusted",
    "mitigation evidence missing",
    "causal chain incomplete",
    "severity evidence mismatch",
  ]);
});

test("operational decision evidence summary: healthy state has no blockers", () => {
  const summary = getOperationalDecisionEvidenceSummary({
    replay_done: true,
    replay_health: "healthy",
    scenario_health: "healthy",
    mitigation_evidence_exists: true,
    rollback_evidence_exists: true,
    causal_chain_complete: true,
    severity_evidence_aligned: true,
    arei_delta_linked_to_mitigation: true,
  });

  assert.equal(summary.total_requirements, 8);
  assert.equal(summary.satisfied_requirements, 8);
  assert.equal(summary.blocking_requirements, 0);
  assert.deepEqual(summary.blocking_reasons, []);
  assert.deepEqual(summary.blocking_reason_messages, []);
});

test("operational decision evidence summary: degraded allowed state preserves blocker summary deterministically", () => {
  const summary = getOperationalDecisionEvidenceSummary({
    replay_done: true,
    replay_health: "stale",
    scenario_health: "partial",
    mitigation_evidence_exists: true,
    rollback_evidence_exists: true,
    causal_chain_complete: true,
    severity_evidence_aligned: true,
    arei_delta_linked_to_mitigation: true,
    allow_degraded_integrity_conclusion: true,
  });

  assert.equal(summary.total_requirements, 8);
  assert.equal(summary.satisfied_requirements, 6);
  assert.equal(summary.blocking_requirements, 2);
  assert.deepEqual(summary.blocking_reasons, [
    "replay_integrity_untrusted",
    "scenario_integrity_untrusted",
  ]);
  assert.deepEqual(summary.blocking_reason_messages, [
    "replay integrity untrusted",
    "scenario integrity untrusted",
  ]);
});

test("operational decision outcome message: uses contract decision state only", () => {
  const allowed = evaluateMitigationConclusionIntegrity({
    replay_done: true,
    replay_health: "healthy",
    scenario_health: "healthy",
    mitigation_evidence_exists: true,
    rollback_evidence_exists: true,
    causal_chain_complete: true,
    severity_evidence_aligned: true,
    arei_delta_linked_to_mitigation: true,
  });
  assert.equal(
    getOperationalDecisionOutcomeMessage(allowed, "custom mitigation outcome"),
    "custom mitigation outcome",
  );

  const blocked = evaluateMitigationConclusionIntegrity({
    replay_done: false,
    replay_health: "healthy",
    scenario_health: "healthy",
    mitigation_evidence_exists: true,
    rollback_evidence_exists: true,
    causal_chain_complete: true,
    severity_evidence_aligned: true,
    arei_delta_linked_to_mitigation: true,
  });
  assert.equal(
    getOperationalDecisionOutcomeMessage(blocked, "custom mitigation outcome"),
    "Mitigation confidence pending replay integrity.",
  );
});
