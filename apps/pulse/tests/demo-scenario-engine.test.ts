import assert from "node:assert/strict";
import test from "node:test";

import { createDemoScenarioReplayController } from "../lib/demo-scenario-engine";

test("demo scenario replay starts at deterministic empty frame", () => {
  const replay = createDemoScenarioReplayController();
  const frame = replay.current();

  assert.equal(frame.cursor, 0);
  assert.equal(frame.total, 3);
  assert.equal(frame.done, false);
  assert.equal(frame.event_id, null);
  assert.equal(frame.scenario_id, "demo-inc-refund-policy-001");
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
