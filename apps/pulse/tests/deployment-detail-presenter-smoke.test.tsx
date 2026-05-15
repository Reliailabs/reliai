import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DeploymentDetailPanel } from "@/components/dashboard/content/deployments-content";
import type { DeploymentDetailPresenter } from "@/lib/deployment-detail-mapper";

const detail: DeploymentDetailPresenter = {
  id: "dep_1",
  promptVersion: "v9",
  modelName: "gpt-x",
  environment: "prod",
  deployedAt: "2026-05-15T00:00:00Z",
  deployedBy: "owner@acme.test",
  metadata: null,
  gate: { decision: "BLOCK", riskScore: 82, explanations: ["high risk"], regression: null },
  intelligence: {
    riskScore: 71,
    riskExplanations: ["reason"],
    graphRiskPatterns: [{ pattern: "latency spike", risk: "high", traceCount: 12 }],
    recommendedGuardrails: ["guardrail-a"],
  },
  incidentIds: ["inc_1"],
  events: [{ id: "evt_1", eventType: "created", createdAt: "2026-05-15T00:00:00Z" }],
};

test("deployment detail panel renders metadata and gate summary", () => {
  const html = renderToStaticMarkup(<DeploymentDetailPanel detail={detail} error={null} />);
  assert.match(html, /dep_1/);
  assert.match(html, /Prompt v9/);
  assert.match(html, /Gate: BLOCK · Risk score 82/);
});

test("deployment detail panel renders risk patterns and linked counts", () => {
  const html = renderToStaticMarkup(<DeploymentDetailPanel detail={detail} error={null} />);
  assert.match(html, /latency spike · high · 12 traces/);
  assert.match(html, /Incidents linked: 1/);
  assert.match(html, /Events: 1/);
});
