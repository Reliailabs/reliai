import assert from "node:assert/strict";
import test from "node:test";

import { buildOperationsReliabilitySummary } from "@/lib/operations-reliability-summary";

test("buildOperationsReliabilitySummary formats deterministic read-consumer text", () => {
  const summary = buildOperationsReliabilitySummary(
    {
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
    },
    new Date("2026-05-16T12:00:00.000Z"),
  );

  assert.equal(
    summary,
    "Reliability snapshot: 66 score · 2 verified · 1 failed · 1 rolled back",
  );
});

test("buildOperationsReliabilitySummary returns stable fallback when snapshot is missing", () => {
  assert.equal(
    buildOperationsReliabilitySummary(undefined),
    "Reliability snapshot unavailable.",
  );
  assert.equal(
    buildOperationsReliabilitySummary(null),
    "Reliability snapshot unavailable.",
  );
});

test("buildOperationsReliabilitySummary marks stale snapshots deterministically", () => {
  const summary = buildOperationsReliabilitySummary(
    {
      snapshot_id: "score-org-demo-1",
      captured_at: "2026-05-14T00:00:00.000Z",
      organization_id: "org-demo",
      project_id: null,
      reliability_score: 66,
      verification_pass_rate: 0.6667,
      verified_count: 2,
      failed_count: 1,
      rolled_back_count: 1,
      requires_operator_review: true,
      execution_granted: false,
    },
    new Date("2026-05-16T12:00:00.000Z"),
  );

  assert.equal(
    summary,
    "Reliability snapshot (stale): 66 score · 2 verified · 1 failed · 1 rolled back",
  );
});

test("buildOperationsReliabilitySummary falls back on malformed numeric fields", () => {
  const summary = buildOperationsReliabilitySummary(
    {
      snapshot_id: "score-org-demo-1",
      captured_at: "2026-05-16T00:00:00.000Z",
      organization_id: "org-demo",
      project_id: null,
      reliability_score: Number.NaN,
      verification_pass_rate: 0.6667,
      verified_count: 2,
      failed_count: 1,
      rolled_back_count: 1,
      requires_operator_review: true,
      execution_granted: false,
    },
    new Date("2026-05-16T12:00:00.000Z"),
  );
  assert.equal(summary, "Reliability snapshot unavailable.");
});
