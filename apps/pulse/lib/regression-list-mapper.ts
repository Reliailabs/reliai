export type RegressionRead = {
  id: string;
  detected_at?: string | null;
  created_at?: string | null;
  metric_name?: string | null;
  current_value?: string | null;
  baseline_value?: string | null;
  delta_percent?: string | null;
  trace_compare_path?: string | null;
  summary?: string | null;
  status?: string | null;
};

export type RegressionListItem = {
  id: string;
  detectedAt: string | null;
  metricName: string;
  currentValue: string;
  baselineValue: string;
  deltaPercent: string | null;
  comparePath: string | null;
  summary: string;
  status: string;
};

export function mapRegressionListItem(item: RegressionRead): RegressionListItem {
  return {
    id: item.id,
    detectedAt: item.detected_at ?? item.created_at ?? null,
    metricName: item.metric_name ?? "metric",
    currentValue: item.current_value ?? "n/a",
    baselineValue: item.baseline_value ?? "n/a",
    deltaPercent: item.delta_percent ?? null,
    comparePath: item.trace_compare_path ?? `/regressions/${item.id}/compare`,
    summary: item.summary ?? "Regression signal detected in reliability window.",
    status: item.status ?? "detected",
  };
}
