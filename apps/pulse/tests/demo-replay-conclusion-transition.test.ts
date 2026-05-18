import assert from "node:assert/strict";
import test from "node:test";

import { getMitigationConclusionDecision } from "../lib/demo-operational-integrity-contract";
import { createDemoScenarioReplayController } from "../lib/demo-scenario-engine";

test("replay transition: mitigation conclusion becomes eligible only after replay completes", () => {
  const replay = createDemoScenarioReplayController();

  const initial = replay.current();
  const initialDecision = getMitigationConclusionDecision(
    initial.done,
    initial.replay_health,
    initial.scenario_health,
  );

  assert.equal(initial.done, false);
  assert.deepEqual(initialDecision, {
    allowed: false,
    block_reason: "replay_not_complete",
  });

  let frame = initial;
  while (!frame.done) {
    frame = replay.next();
  }

  const completedDecision = getMitigationConclusionDecision(
    frame.done,
    frame.replay_health,
    frame.scenario_health,
  );

  assert.equal(frame.done, true);
  assert.deepEqual(completedDecision, {
    allowed: true,
    block_reason: "none",
  });
});
