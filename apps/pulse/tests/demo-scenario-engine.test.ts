import assert from "node:assert/strict";
import test from "node:test";

import { createDemoScenarioReplayController } from "../lib/demo-scenario-engine";
import { getDemoScenarioFixture } from "../lib/demo-scenario-fixtures";

test("demo scenario replay starts at deterministic empty frame", () => {
  const replay = createDemoScenarioReplayController();
  const frame = replay.current();

  assert.equal(frame.cursor, 0);
  assert.equal(frame.total, 3);
  assert.equal(frame.done, false);
  assert.equal(frame.event_id, null);
  assert.equal(frame.scenario_id, "demo-inc-refund-policy-001");
  assert.equal(frame.replay_health, "healthy");
  assert.equal(frame.scenario_health, "healthy");
});

test("demo scenario replay advances deterministically and finishes mitigated", () => {
  const replay = createDemoScenarioReplayController();

  const step1 = replay.next();
  assert.equal(step1.cursor, 1);
  assert.equal(step1.event_id, "evt-demo-001");
  assert.equal(step1.incident_status, "investigating");

  const step2 = replay.next();
  assert.equal(step2.cursor, 2);
  assert.equal(step2.event_id, "evt-demo-002");

  const step3 = replay.next();
  assert.equal(step3.cursor, 3);
  assert.equal(step3.done, true);
  assert.equal(step3.event_id, "evt-demo-003");
  assert.equal(step3.incident_status, "mitigated");
});

test("demo scenario replay seek/reset are bounded and stable", () => {
  const replay = createDemoScenarioReplayController();

  const pastEnd = replay.seek(999);
  assert.equal(pastEnd.cursor, 3);
  assert.equal(pastEnd.done, true);

  const beforeStart = replay.seek(-5);
  assert.equal(beforeStart.cursor, 0);
  assert.equal(beforeStart.event_id, null);

  const reset = replay.reset();
  assert.equal(reset.cursor, 0);
  assert.equal(reset.done, false);
});

test("demo scenario replay surfaces stale/partial/unknown health deterministically", () => {
  const base = getDemoScenarioFixture();

  const stale = createDemoScenarioReplayController({
    ...base,
    replay_profile: { stale: true, partial: false, unknown_outcome: false },
  }).current();
  assert.equal(stale.replay_health, "stale");

  const partial = createDemoScenarioReplayController({
    ...base,
    replay_profile: { stale: false, partial: true, unknown_outcome: false },
  }).current();
  assert.equal(partial.replay_health, "partial");

  const unknown = createDemoScenarioReplayController({
    ...base,
    replay_profile: { stale: false, partial: false, unknown_outcome: true },
    scenario_profile: { stale_mitigation: false, partial_evidence: false, unknown_outcome: true },
  }).current();
  assert.equal(unknown.replay_health, "unknown");
  assert.equal(unknown.scenario_health, "unknown");
});
