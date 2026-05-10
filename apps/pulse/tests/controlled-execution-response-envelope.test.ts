import assert from "node:assert/strict";
import test from "node:test";

import {
  PHASE8_VALIDATOR_RESPONSE_CONTRACT,
  withPhase8ValidatorEnvelope,
} from "../app/api/actions/controlled-execution/_response";

test("phase 8 validator response contract stays validation-only", () => {
  assert.equal(PHASE8_VALIDATOR_RESPONSE_CONTRACT.contract_version, "phase8-v1");
  assert.equal(PHASE8_VALIDATOR_RESPONSE_CONTRACT.mode, "validation_only");
  assert.equal(PHASE8_VALIDATOR_RESPONSE_CONTRACT.execution_granted, false);
});

test("response helper preserves payload fields while injecting contract envelope", () => {
  const response = withPhase8ValidatorEnvelope({
    ok: true as const,
    warnings: ["w1"],
    request: { execution_id: "exec_1" },
  });

  assert.equal(response.contract_version, "phase8-v1");
  assert.equal(response.mode, "validation_only");
  assert.equal(response.execution_granted, false);
  assert.equal(response.ok, true);
  assert.deepEqual(response.warnings, ["w1"]);
  assert.deepEqual(response.request, { execution_id: "exec_1" });
});
