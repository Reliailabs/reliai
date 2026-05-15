import type { ProjectReliabilityRead } from "@reliai/types";

export type ProjectReliabilityPresenter = {
  projectId: string;
  projectName: string;
  reliabilityScore: number | null;
  metrics: Array<{ label: string; value: string }>;
  trendSeries: Array<{ metricName: string; latestValue: number | null; pointCount: number }>;
  recentIncidents: Array<{ id: string; title: string; severity: string; status: string; startedAt: string }>;
  sourceErrors: string[];
};

function pct(value: number | null): string {
  if (value === null) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function num(value: number | null, suffix = ""): string {
  if (value === null) return "n/a";
  return `${Math.round(value)}${suffix}`;
}

export function mapProjectReliabilityPresenter(
  projectId: string,
  projectName: string,
  reliability: ProjectReliabilityRead | null,
  sourceErrors: string[],
): ProjectReliabilityPresenter {
  const trendSeries =
    reliability?.trend_series.map((series) => {
      const latestPoint = series.points[series.points.length - 1] ?? null;
      return {
        metricName: series.metric_name,
        latestValue: latestPoint?.value_number ?? null,
        pointCount: series.points.length,
      };
    }) ?? [];

  return {
    projectId,
    projectName,
    reliabilityScore: reliability?.reliability_score ?? null,
    metrics: [
      { label: "Detection coverage", value: pct(reliability?.detection_coverage ?? null) },
      { label: "Alert delivery", value: pct(reliability?.alert_delivery_success_rate ?? null) },
      { label: "MTTA p90", value: num(reliability?.MTTA_p90 ?? null, " min") },
      { label: "MTTR p90", value: num(reliability?.MTTR_p90 ?? null, " min") },
      { label: "False positive rate", value: pct(reliability?.false_positive_rate ?? null) },
      { label: "Telemetry freshness", value: num(reliability?.telemetry_freshness_minutes ?? null, " min") },
    ],
    trendSeries,
    recentIncidents:
      reliability?.recent_incidents.map((incident) => ({
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        startedAt: incident.started_at,
      })) ?? [],
    sourceErrors,
  };
}
