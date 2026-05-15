import assert from "node:assert/strict";
import test from "node:test";

import { mapDeploymentDetailPresenter } from "@/lib/deployment-detail-mapper";

test("maps deployment detail contract into presenter shape", () => {
  const mapped = mapDeploymentDetailPresenter({
    id: "dep_1",
    environment: "prod",
    deployed_at: "2026-05-15T00:00:00Z",
    deployed_by: "owner@acme.test",
    metadata_json: { summary: "release" },
    prompt_version: { version: "v7" },
    model_version: { model_name: "gpt-x" },
    incident_ids: ["inc_1", "inc_2"],
    events: [{ id: "evt_1", event_type: "created", created_at: "2026-05-15T00:00:00Z" }],
    gate: {
      decision: "ALLOW",
      risk_score: 22,
      explanations: ["low risk"],
      recommended_guardrails: [],
      regression_risk: { is_regression: false, reasons: [] },
    },
    intelligence: {
      risk_score: 33,
      risk_explanations: ["reason a"],
      graph_risk_patterns: [{ pattern: "timeout", risk: "medium", trace_count: 4 }],
      recommended_guardrails: ["rate-limit"],
    },
  });

  assert.equal(mapped.id, "dep_1");
  assert.equal(mapped.promptVersion, "v7");
  assert.equal(mapped.modelName, "gpt-x");
  assert.equal(mapped.gate?.riskScore, 22);
  assert.equal(mapped.intelligence?.graphRiskPatterns[0]?.traceCount, 4);
  assert.equal(mapped.incidentIds.length, 2);
  assert.equal(mapped.events.length, 1);
});
