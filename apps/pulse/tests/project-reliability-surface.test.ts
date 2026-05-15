import assert from "node:assert/strict";
import test from "node:test";

import { mapProjectReliabilityPresenter } from "@/lib/project-reliability-mapper";

test("maps project reliability contract into presenter metrics/trends/incidents", () => {
  const mapped = mapProjectReliabilityPresenter(
    "proj_1",
    "Project One",
    {
      project_id: "proj_1",
      organization_id: "org_1",
      reliability_score: 0.81,
      detection_latency_p90: 8,
      MTTA_p90: 12,
      MTTR_p90: 55,
      false_positive_rate: 0.04,
      detection_coverage: 0.93,
      alert_delivery_success_rate: 0.98,
      explainability_score: 0.88,
      incident_density: 1.2,
      telemetry_freshness_minutes: 7,
      quality_pass_rate: 0.95,
      structured_output_validity_rate: 0.99,
      root_cause_localization_score: 0.82,
      traces_last_24h: 1200,
      recent_incidents: [
        {
          id: "inc_1",
          incident_type: "latency",
          severity: "high",
          status: "open",
          title: "Latency spike",
          started_at: "2026-05-15T00:00:00Z",
          updated_at: "2026-05-15T00:02:00Z",
        },
      ],
      trend_series: [
        {
          metric_name: "detection_latency_p90",
          unit: "minutes",
          points: [
            {
              metric_name: "detection_latency_p90",
              window_start: "2026-05-14T00:00:00Z",
              window_end: "2026-05-14T01:00:00Z",
              value_number: 10,
              numerator: null,
              denominator: null,
              unit: "minutes",
              computed_at: "2026-05-14T01:00:00Z",
              metadata_json: null,
            },
            {
              metric_name: "detection_latency_p90",
              window_start: "2026-05-15T00:00:00Z",
              window_end: "2026-05-15T01:00:00Z",
              value_number: 8,
              numerator: null,
              denominator: null,
              unit: "minutes",
              computed_at: "2026-05-15T01:00:00Z",
              metadata_json: null,
            },
          ],
        },
      ],
    },
    [],
  );

  assert.equal(mapped.projectId, "proj_1");
  assert.equal(mapped.projectName, "Project One");
  assert.equal(mapped.reliabilityScore, 0.81);
  assert.equal(mapped.metrics.length, 6);
  assert.equal(mapped.trendSeries[0]?.metricName, "detection_latency_p90");
  assert.equal(mapped.trendSeries[0]?.latestValue, 8);
  assert.equal(mapped.recentIncidents[0]?.id, "inc_1");
});
