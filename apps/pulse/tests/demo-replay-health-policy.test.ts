import assert from "node:assert/strict";
import test from "node:test";

import { getReplayHealthPolicy } from "../lib/demo-replay-health-policy";

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
