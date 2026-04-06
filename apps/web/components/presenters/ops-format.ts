export function percent(value: number | null) {
  if (value === null) return "n/a";
  return `${(value * 100).toFixed(0)}%`;
}

export function decimal(value: number | null) {
  if (value === null) return "n/a";
  return value.toFixed(2);
}

export function latency(value: number | null) {
  if (value === null) return "n/a";
  return `${Math.round(value)}ms`;
}

export function formatTime(value: string | null, screenshotMode = false) {
  if (!value) return "n/a";
  if (screenshotMode) {
    return "Today";
  }
  return new Date(value).toLocaleString();
}

export function scoreTone(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-danger";
}

export function riskTone(level: string | null) {
  if (level === "high") return "text-danger";
  if (level === "medium") return "text-warning";
  if (level === "low") return "text-success";
  return "text-secondary";
}

export function coverageTone(value: number) {
  if (value >= 95) return "text-success";
  if (value >= 85) return "text-warning";
  return "text-danger";
}

export function actionStatusTone(status: string) {
  if (status === "success") return "badge badge-success";
  if (status === "dry_run") return "badge badge-neutral";
  if (status.startsWith("skipped_")) return "badge badge-warning";
  if (status === "error") return "badge badge-danger";
  return "badge badge-neutral";
}

export function severityTone(severity: string) {
  if (severity === "critical") return "badge badge-danger";
  if (severity === "high") return "badge badge-warning";
  if (severity === "medium") return "badge badge-warning";
  return "badge badge-neutral";
}

export function renderProbability(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function gateTone(decision: string | null | undefined) {
  if (decision === "BLOCK") return "tone-danger";
  if (decision === "WARN") return "tone-warning";
  return "tone-success";
}

export function gateLabel(decision: string | null | undefined) {
  if (decision === "BLOCK") return "BLOCKED";
  if (decision === "WARN") return "WARNING";
  return "SAFE";
}

export function renderMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "No metadata recorded.";
  }
  return JSON.stringify(metadata, null, 2);
}

const METRIC_DISPLAY_NAMES: Record<string, string> = {
  refusal_rate: "Refusal rate",
  success_rate: "Success rate",
  structured_output_validity_pass_rate: "Structured output validity",
  p95_latency_ms: "P95 latency",
  median_latency_ms: "Median latency",
  average_cost_usd_per_trace: "Cost per trace",
};

export function getMetricDisplayName(
  metricName: string | null | undefined,
  summary?: Record<string, unknown>,
): string {
  if (!metricName) return "metric";
  if (metricName in METRIC_DISPLAY_NAMES) return METRIC_DISPLAY_NAMES[metricName];
  if (metricName.startsWith("custom_metric.")) {
    const stored = summary?.custom_metric_name;
    if (typeof stored === "string" && stored) return `${stored} rate`;
    const key = metricName.replace(/^custom_metric\./, "").replace(/_rate$/, "");
    return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " rate";
  }
  return metricName.replace(/[_.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
