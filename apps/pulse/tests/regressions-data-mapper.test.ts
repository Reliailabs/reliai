import assert from "node:assert/strict";
import test from "node:test";

import { mapRegressionListItem } from "@/lib/regression-list-mapper";

test("maps regression snapshot into richer presenter item", () => {
  const mapped = mapRegressionListItem({
    id: "reg_1",
    detected_at: "2026-05-15T00:00:00Z",
    metric_name: "failure_rate",
    current_value: "0.14",
    baseline_value: "0.02",
    delta_percent: "600%",
    trace_compare_path: "/regressions/reg_1/compare",
    summary: "Failure rate elevated",
    status: "open",
  });

  assert.equal(mapped.id, "reg_1");
  assert.equal(mapped.metricName, "failure_rate");
  assert.equal(mapped.currentValue, "0.14");
  assert.equal(mapped.baselineValue, "0.02");
  assert.equal(mapped.deltaPercent, "600%");
  assert.equal(mapped.comparePath, "/regressions/reg_1/compare");
  assert.equal(mapped.status, "open");
});
