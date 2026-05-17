import assert from "node:assert/strict";
import test from "node:test";

import { getIncidentOperationsSurfaceData } from "@/lib/incident-operations-data";
import { InMemoryProposalLifecycleRepository } from "@/lib/proposal-lifecycle";
import type { OperationsSurfaceData } from "@/components/dashboard/pulse-types";

const STUB_SNAPSHOT: NonNullable<OperationsSurfaceData["reliabilitySnapshot"]> = {
  snapshot_id: "score-org-demo-1",
  captured_at: new Date().toISOString(),
  organization_id: "org-demo",
  project_id: null,
  reliability_score: 72,
  verification_pass_rate: 0.75,
  verified_count: 3,
  failed_count: 1,
  rolled_back_count: 0,
  requires_operator_review: true,
  execution_granted: false,
};

test("reliabilitySnapshot is forwarded from operations data when present", async () => {
  const data = await getIncidentOperationsSurfaceData("inc-test-001", {
    lifecycleRepo: new InMemoryProposalLifecycleRepository(),
    getReliabilitySnapshot: () => STUB_SNAPSHOT,
  });

  assert.deepEqual(data.reliabilitySnapshot, STUB_SNAPSHOT);
});

test("reliabilitySnapshot is null when snapshot reader returns null", async () => {
  const data = await getIncidentOperationsSurfaceData("inc-test-002", {
    lifecycleRepo: new InMemoryProposalLifecycleRepository(),
    getReliabilitySnapshot: () => null,
  });

  assert.strictEqual(data.reliabilitySnapshot, null);
});
