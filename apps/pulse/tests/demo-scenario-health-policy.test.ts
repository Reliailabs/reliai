import assert from "node:assert/strict";
import test from "node:test";

import { getScenarioHealthPolicy } from "../lib/demo-scenario-health-policy";

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
