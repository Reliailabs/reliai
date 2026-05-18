import assert from "node:assert/strict";
import test from "node:test";

import { evaluateMitigationConclusionIntegrity } from "../lib/demo-operational-integrity-contract";
import { createDemoScenarioReplayController } from "../lib/demo-scenario-engine";

test("replay transition: mitigation conclusion becomes eligible only after replay completes", () => {
  const replay = createDemoScenarioReplayController();

  const initial = replay.current();
  const initialDecision = evaluateMitigationConclusionIntegrity({
    replay_done: initial.done,
    replay_health: initial.replay_health,
    scenario_health: initial.scenario_health,
    mitigation_evidence_exists: true,
    rollback_evidence_exists: true,
    causal_chain_complete: true,
    severity_evidence_aligned: true,
    arei_delta_linked_to_mitigation: true,
  });

  assert.equal(initial.done, false);
  assert.equal(initialDecision.decision_allowed, false);
  assert.deepEqual(initialDecision.policy_reasons, ["replay_not_complete"]);

  let frame = initial;
  while (!frame.done) {
    frame = replay.next();
  }

  const completedDecision = evaluateMitigationConclusionIntegrity({
    replay_done: frame.done,
    replay_health: frame.replay_health,
    scenario_health: frame.scenario_health,
    mitigation_evidence_exists: true,
    rollback_evidence_exists: true,
    causal_chain_complete: true,
    severity_evidence_aligned: true,
    arei_delta_linked_to_mitigation: true,
  });

  assert.equal(frame.done, true);
  assert.equal(completedDecision.decision_allowed, true);
  assert.deepEqual(completedDecision.policy_reasons, []);
});
