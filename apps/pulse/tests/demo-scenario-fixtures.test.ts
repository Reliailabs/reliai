import assert from "node:assert/strict";
import test from "node:test";

import { getDemoScenarioFixture } from "../lib/demo-scenario-fixtures";

test("demo fixture is deterministic across calls", () => {
  const a = getDemoScenarioFixture();
  const b = getDemoScenarioFixture();

  assert.deepEqual(a, b);
});

test("demo fixture contains stable scenario identifiers and timeline ordering", () => {
  const fixture = getDemoScenarioFixture();

  assert.equal(fixture.scenario_id, "demo-inc-refund-policy-001");
  assert.equal(fixture.incident.id, "inc-demo-001");
  assert.equal(fixture.trace.id, "trace-demo-001");
  assert.equal(fixture.timeline.length, 3);

  const ordered = fixture.timeline.every((evt, i, arr) => {
    if (i === 0) return true;
    return arr[i - 1].at <= evt.at;
  });
  assert.equal(ordered, true);
});

test("demo fixture reliability fields are bounded for replay safety", () => {
  const fixture = getDemoScenarioFixture();
  const { before_score, after_score, verification_pass_rate } = fixture.reliability;

  assert.ok(before_score >= 0 && before_score <= 100);
  assert.ok(after_score >= 0 && after_score <= 100);
  assert.ok(verification_pass_rate >= 0 && verification_pass_rate <= 1);
});
