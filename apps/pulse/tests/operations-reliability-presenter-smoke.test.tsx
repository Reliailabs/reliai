import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { OperationsReliabilitySummaryPanel } from "@/components/operations/operations-reliability-summary-panel";

test("reliability summary panel renders populated snapshot text", () => {
  const html = renderToStaticMarkup(
    <OperationsReliabilitySummaryPanel
      snapshot={{
        snapshot_id: "score-org-demo-1",
        captured_at: "2026-05-16T00:00:00.000Z",
        organization_id: "org-demo",
        project_id: null,
        reliability_score: 66,
        verification_pass_rate: 0.6667,
        verified_count: 2,
        failed_count: 1,
        rolled_back_count: 1,
        requires_operator_review: true,
        execution_granted: false,
      }}
    />, 
  );

  assert.match(html, /Reliability snapshot: 66 score · 2 verified · 1 failed · 1 rolled back/);
});

test("reliability summary panel renders unavailable state when snapshot missing", () => {
  const html = renderToStaticMarkup(
    <OperationsReliabilitySummaryPanel snapshot={null} />, 
  );

  assert.match(html, /Reliability snapshot unavailable\./);
});
