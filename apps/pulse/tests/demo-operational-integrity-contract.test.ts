import assert from "node:assert/strict";
import test from "node:test";

import {
  canConcludeMitigation,
  deriveReplayHealth,
  deriveScenarioHealth,
  getMitigationConclusionDecision,
  getReplayHealthPolicy,
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
  assert.equal(canConcludeMitigation("healthy", "healthy"), true);
  assert.equal(canConcludeMitigation("partial", "healthy"), false);
  assert.equal(canConcludeMitigation("healthy", "partial"), false);
  assert.equal(canConcludeMitigation("unknown", "healthy"), false);
  assert.equal(canConcludeMitigation("healthy", "unknown"), false);
  assert.equal(canConcludeMitigation("unknown", "unknown"), false);
});

test("mitigation conclusion decision returns deterministic block reasons", () => {
  assert.deepEqual(getMitigationConclusionDecision("healthy", "healthy"), {
    allowed: true,
    block_reason: "none",
  });
  assert.deepEqual(getMitigationConclusionDecision("unknown", "healthy"), {
    allowed: false,
    block_reason: "replay_health_not_trustworthy",
  });
  assert.deepEqual(getMitigationConclusionDecision("healthy", "partial"), {
    allowed: false,
    block_reason: "scenario_health_not_trustworthy",
  });
  assert.deepEqual(getMitigationConclusionDecision("stale", "unknown"), {
    allowed: false,
    block_reason: "both_health_dimensions_not_trustworthy",
  });
});
