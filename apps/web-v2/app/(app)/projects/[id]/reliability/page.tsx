import Link from "next/link";
import { ArrowLeft, ArrowRight, ChartColumn, FolderKanban, History, ShieldCheck, ShieldX } from "lucide-react";

import type { ReliabilityMetricSeriesRead } from "@reliai/types";

import { getProject, getProjectReliability, listProjectCustomMetrics } from "@/lib/api";

function percent(value: number | null) {
  if (value === null) return "n/a";
  return `${(value * 100).toFixed(0)}%`;
}

function numberValue(value: number | null, suffix = "") {
  if (value === null) return "n/a";
  return `${value.toFixed(value >= 10 ? 0 : 2)}${suffix}`;
}

function toneForRate(value: number | null, threshold = 0.9) {
  if (value === null) return "text-zinc-500";
  return value >= threshold ? "text-emerald-400" : "text-rose-400";
}

function toneForInverse(value: number | null, maxValue: number) {
  if (value === null) return "text-zinc-500";
  return value <= maxValue ? "text-emerald-400" : "text-rose-400";
}

function Sparkline({ series }: { series: ReliabilityMetricSeriesRead }) {
  const values = series.points.map((point) => point.value_number);
  if (values.length < 2) {
    return <div className="h-16 rounded-lg border border-dashed border-zinc-800 bg-zinc-900" />;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const width = 240;
  const height = 56;
  const step = width / Math.max(values.length - 1, 1);
  const path = values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * (height - 8) - 4;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full">
      <path d={path} fill="none" stroke="#1f4d78" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function ScorePill({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="inline-flex rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-700">No score</span>;
  }
  const tone =
    score >= 0.875
      ? "bg-emerald-900 text-emerald-400 ring-1 ring-emerald-800"
      : score >= 0.625
        ? "bg-amber-900 text-amber-400 ring-1 ring-amber-800"
        : "bg-rose-900 text-rose-400 ring-1 ring-rose-800";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${tone}`}>{percent(score)}</span>;
}

export default async function ProjectReliabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const rawSearchParams = searchParams ? await searchParams : {};
  const environment =
    typeof rawSearchParams.environment === "string" ? rawSearchParams.environment : undefined;
  const [project, reliability, customMetricsResponse] = await Promise.all([
    getProject(id),
    getProjectReliability(id, environment),
    listProjectCustomMetrics(id).catch(() => ({ items: [] })),
  ]);

  const customMetrics = customMetricsResponse.items.filter((metric) => metric.enabled);
  const behavioralSeries = reliability.trend_series.filter((series) => {
    const name = series.metric_name.toLowerCase();
    return name.includes("custom_metric") || name.includes("refusal");
  });

  const behavioralSignals = customMetrics
    .map((metric) => {
      const metricKey = metric.metric_key.toLowerCase();
      const metricName = metric.name.toLowerCase();
      const series =
        behavioralSeries.find((item) => item.metric_name.toLowerCase().includes(metricKey)) ??
        behavioralSeries.find((item) => item.metric_name.toLowerCase().includes(metricName));
      const latestPoint = series?.points[series.points.length - 1] ?? null;
      return {
        metric,
        series,
        latestPoint,
      };
    })
    .sort((a, b) => {
      const aValue = a.latestPoint?.value_number ?? 0;
      const bValue = b.latestPoint?.value_number ?? 0;
      if (bValue !== aValue) return bValue - aValue;
      return new Date(b.metric.updated_at).getTime() - new Date(a.metric.updated_at).getTime();
    })
    .slice(0, 3);

  const headlineCards = [
    {
      label: "Reliability score",
      value: reliability.reliability_score === null ? "n/a" : percent(reliability.reliability_score),
      note: "Share of current scorecard metrics meeting target.",
      tone: reliability.reliability_score !== null && reliability.reliability_score >= 0.75 ? "text-emerald-400" : "text-zinc-100",
    },
    {
      label: "Detection coverage",
      value: percent(reliability.detection_coverage),
      note: "Breach snapshots that mapped to an incident.",
      tone: toneForRate(reliability.detection_coverage),
    },
    {
      label: "Alert success",
      value: percent(reliability.alert_delivery_success_rate),
      note: "Slack deliveries that reached sent state.",
      tone: toneForRate(reliability.alert_delivery_success_rate, 0.95),
    },
    {
      label: "Telemetry freshness",
      value: numberValue(reliability.telemetry_freshness_minutes, " min"),
      note: "Minutes since the last trace was received.",
      tone: toneForInverse(reliability.telemetry_freshness_minutes, 15),
    },
  ];

  const metricCards = [
    {
      label: "Detection latency p90",
      value: numberValue(reliability.detection_latency_p90, " min"),
      tone: toneForInverse(reliability.detection_latency_p90, 15),
    },
    {
      label: "MTTA p90",
      value: numberValue(reliability.MTTA_p90, " min"),
      tone: toneForInverse(reliability.MTTA_p90, 30),
    },
    {
      label: "MTTR p90",
      value: numberValue(reliability.MTTR_p90, " min"),
      tone: toneForInverse(reliability.MTTR_p90, 240),
    },
    {
      label: "False positive rate",
      value: percent(reliability.false_positive_rate),
      tone: toneForInverse(reliability.false_positive_rate, 0.1),
    },
    {
      label: "Explainability score",
      value: percent(reliability.explainability_score),
      tone: toneForRate(reliability.explainability_score, 0.95),
    },
    {
      label: "Incident density",
      value: numberValue(reliability.incident_density),
      tone: toneForInverse(reliability.incident_density, 2),
    },
    {
      label: "Quality pass rate",
      value: percent(reliability.quality_pass_rate),
      tone: toneForRate(reliability.quality_pass_rate),
    },
    {
      label: "Structured validity rate",
      value: percent(reliability.structured_output_validity_rate),
      tone: toneForRate(reliability.structured_output_validity_rate),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-zinc-800 bg-zinc-950 px-6 py-6 shadow-sm">
        <a
          href={`/projects/${id}/regressions${environment ? `?environment=${encodeURIComponent(environment)}` : ""}`}
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to regressions
        </a>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Project reliability</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">{project.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              Track operator-facing reliability metrics derived from persisted incidents, alert deliveries,
              regression snapshots, rollups, and trace completeness.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`/projects/${id}/timeline${environment ? `?environment=${encodeURIComponent(environment)}` : ""}`}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-900"
            >
              <History className="h-4 w-4" />
              Timeline
            </a>
            <Link
              href={`/projects/${id}/metrics`}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-900"
            >
              Manage custom metrics
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/projects/${id}/ingestion`}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-900"
            >
              Manage ingestion policy
              <ArrowRight className="h-4 w-4" />
            </Link>
            <ScorePill score={reliability.reliability_score} />
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-500">
              {environment ?? project.environment}
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {headlineCards.map((card) => (
          <div key={card.label} className="rounded-lg border-zinc-800 p-5">
            <p className="text-sm text-zinc-500">{card.label}</p>
            <p className={`mt-3 text-3xl font-semibold ${card.tone}`}>{card.value}</p>
            <p className="mt-3 text-sm leading-6 text-zinc-500">{card.note}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="rounded-lg border-zinc-800 p-6">
          <div className="flex items-center gap-3">
            <ChartColumn className="h-5 w-5 text-zinc-500" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Trend series</p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Recent reliability trends</h2>
            </div>
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {reliability.trend_series.map((series) => (
              <div key={series.metric_name} className="rounded-lg border border-zinc-800 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{series.metric_name}</p>
                    <p className="mt-1 text-sm text-zinc-500">{series.unit}</p>
                  </div>
                  <p className="text-sm font-medium text-zinc-100">
                    {series.points.length > 0 ? numberValue(series.points[series.points.length - 1].value_number) : "n/a"}
                  </p>
                </div>
                <div className="mt-4">
                  <Sparkline series={series} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border-zinc-800 p-6">
            <div className="flex items-center gap-3">
              {reliability.telemetry_freshness_minutes !== null && reliability.telemetry_freshness_minutes <= 15 ? (
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              ) : (
                <ShieldX className="h-5 w-5 text-rose-400" />
              )}
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Operational state</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Scorecard metrics</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {metricCards.map((card) => (
                <div key={card.label} className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{card.label}</p>
                  </div>
                  <p className={`text-sm font-medium ${card.tone}`}>{card.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border-zinc-800 p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-zinc-500" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Behavioral signals</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Custom behavior metrics</h2>
              </div>
            </div>
            {behavioralSignals.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-zinc-800 bg-zinc-900 px-5 py-6 text-sm text-zinc-500">
                <p className="text-sm font-medium text-zinc-100">No custom metrics yet</p>
                <p className="mt-2 text-sm text-zinc-500">
                  Track behaviors like refusals, hallucinations, or policy violations.
                </p>
                <Link
                  href={`/projects/${id}/metrics`}
                  className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-100 hover:underline"
                >
                  Create your first metric
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {behavioralSignals.map(({ metric, series, latestPoint }) => {
                  const unit = series?.unit ?? "";
                  const windowMinutes = latestPoint?.window_minutes ?? null;
                  const windowLabel = windowMinutes === 1440 ? "last 24h" : "last window";
                  const latestValue = latestPoint ? numberValue(latestPoint.value_number) : "n/a";
                  return (
                    <div key={metric.id} className="rounded-lg border border-zinc-800 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-100">{metric.name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
                            Trigger rate · {windowLabel}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-zinc-100">
                          {latestValue}{unit ? ` ${unit}` : ""}
                        </p>
                      </div>
                      {series ? (
                        <div className="mt-3">
                          <Sparkline series={series} />
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-zinc-500">No recent signal data yet.</p>
                      )}
                      <Link
                        href={`/traces?project_id=${encodeURIComponent(id)}`}
                        className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-100 hover:underline"
                      >
                        View triggering traces
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-4 text-sm text-zinc-500">
              These metrics are tied to incidents when thresholds are exceeded.
            </p>
          </div>

          <div className="rounded-lg border-zinc-800 p-6">
            <div className="flex items-center gap-3">
              <FolderKanban className="h-5 w-5 text-zinc-500" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Recent incidents</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Latest project incidents</h2>
              </div>
            </div>
            {reliability.recent_incidents.length === 0 ? (
              <p className="mt-5 text-sm leading-6 text-zinc-500">
                No incidents have been recorded for this project in the current list window.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {reliability.recent_incidents.map((incident) => (
                  <Link
                    key={incident.id}
                    href={`/incidents/${incident.id}`}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3 transition hover:bg-zinc-900"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{incident.title}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {incident.incident_type} · {new Date(incident.started_at).toLocaleString()}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-zinc-500" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
