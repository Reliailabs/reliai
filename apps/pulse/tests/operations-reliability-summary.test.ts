import assert from "node:assert/strict";
import test from "node:test";

import { buildOperationsReliabilitySummary } from "@/lib/operations-reliability-summary";

test("buildOperationsReliabilitySummary formats deterministic read-consumer text", () => {
  const summary = buildOperationsReliabilitySummary({
    snapshot_id: "score-org-demo-1",
    captured_at: "2026-05-16T01:00:00.000Z",
    organization_id: "org-demo",
    project_id: null,
    reliability_score: 66,
    verification_pass_rate: 0.6667,
    verified_count: 2,
    failed_count: 1,
    rolled_back_count: 1,
    requires_operator_review: true,
    execution_granted: false,
  });

  assert.equal(
    summary,
    "Reliability snapshot: 66 score · 2 verified · 1 failed · 1 rolled back",
  );
});
