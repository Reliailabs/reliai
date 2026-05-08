import assert from "node:assert/strict";
import test from "node:test";

import { computeArei } from "../lib/arei";

test("low score scenario", () => {
  const result = computeArei({
    incidents: [],
    traces: [{ success: true } as any, { success: true } as any],
    regressions: [],
    guardrails: [{ enabled: true, enforcement_mode: "block" } as any],
    audits: [{ latest_run: { certification_status: "pass", status: "completed" } } as any],
    deployments: [],
  });

  assert.equal(result.band, "low");
  assert.ok(result.score <= 24);
});

test("critical score scenario", () => {
  const result = computeArei({
    incidents: [
      { status: "open", severity: "critical" } as any,
      { status: "open", severity: "critical" } as any,
      { status: "open", severity: "high" } as any,
    ],
    traces: Array.from({ length: 20 }, () => ({ success: false } as any)),
    regressions: [{}, {}, {}, {}] as any,
    guardrails: [],
    audits: [],
    deployments: [{}, {}] as any,
  });

  assert.equal(result.band, "critical");
  assert.ok(result.score >= 75);
});

test("missing data degrades gracefully", () => {
  const result = computeArei({});

  assert.ok(result.score >= 0);
  assert.ok(result.topDrivers.some((d) => d.includes("missing") || d.includes("inferred")));
  assert.ok(result.recommendedActions.length > 0);
});

test("open incidents increase score", () => {
  const baseline = computeArei({ incidents: [] });
  const withIncidents = computeArei({
    incidents: [{ status: "open", severity: "critical" } as any],
  });

  assert.ok(withIncidents.score > baseline.score);
  assert.ok(withIncidents.components.incidentRisk > baseline.components.incidentRisk);
});

test("failed eval/regressions proxy signals increase score", () => {
  const baseline = computeArei({ traces: [{ success: true } as any] });
  const degraded = computeArei({
    traces: [{ success: false } as any, { success: false } as any, { success: false } as any],
    regressions: [{}, {}] as any,
  });

  assert.ok(degraded.score > baseline.score);
  assert.ok(degraded.components.failureRisk >= baseline.components.failureRisk);
  assert.ok(degraded.components.driftRisk > baseline.components.driftRisk);
});

test("recent deployment plus regression increases drift risk", () => {
  const withoutDeploy = computeArei({ regressions: [{}] as any, deployments: [] });
  const withDeploy = computeArei({ regressions: [{}] as any, deployments: [{}] as any });

  assert.ok(withDeploy.components.driftRisk > withoutDeploy.components.driftRisk);
});
