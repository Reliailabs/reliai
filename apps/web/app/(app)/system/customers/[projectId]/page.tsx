import Link from "next/link";
import { Fragment } from "react";
import { AlertTriangle, ArrowLeft, Boxes, GitCommitHorizontal, ShieldAlert, Workflow } from "lucide-react";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { getSystemCustomerDetail } from "@/lib/api";

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function riskTone(riskLevel: string) {
  if (riskLevel === "high") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (riskLevel === "medium") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
}

function severityTone(severity: string) {
  if (severity === "critical") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (severity === "high") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  if (severity === "medium") return "bg-sky-100 text-sky-700 ring-1 ring-sky-200";
  return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
}

function timelinePrefix(eventType: string) {
  if (eventType === "incident") return "Incident";
  if (eventType === "regression") return "Regression";
  if (eventType === "deployment") return "Deployment";
  if (eventType === "guardrail" || eventType === "guardrail_runtime_enforced") return "Guardrail";
  return eventType.replaceAll("_", " ");
}

function timelinePrefixTone(eventType: string) {
  if (eventType === "incident") return "text-danger";
  if (eventType === "regression") return "text-warning";
  return "text-secondary";
}

function emphasizeNumbers(summary: string) {
  const pattern = /(\d+(?:\.\d+)?)/g;
  const parts = summary.split(pattern);
  if (parts.length === 1) return summary;
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <span key={`${part}-${index}`} className="metric-value text-mono-data">
        {part}
      </span>
    ) : (
      <Fragment key={`${part}-${index}`}>{part}</Fragment>
    )
  );
}

function maxPoint(points: { trace_volume: number }[]) {
  return Math.max(...points.map((point) => point.trace_volume), 1);
}

export default async function SystemCustomerDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const detail = await getSystemCustomerDetail(projectId).catch((error: Error) => {
    if (error.message.includes("403") || error.message.includes("404")) {
      return null;
    }
    throw error;
  });

  if (!detail) {
    notFound();
  }

  const chartMax = maxPoint(detail.trace_volume_chart);

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[30px] border border-zinc-300 bg-white shadow-sm">
        <div className="relative border-b border-zinc-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.07),transparent_42%),radial-gradient(circle_at_top_right,rgba(14,116,144,0.12),transparent_36%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] px-6 py-6">
          <Link href="/system/customers" className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Back to customer health
          </Link>
          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Customer drilldown</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{detail.project.project_name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-steel">
                Project-level operational readout combining warehouse trace volume, runtime guardrails, incident
                history, deployment changes, and processor failures.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-zinc-300 bg-white/85 px-5 py-3 text-sm font-semibold text-ink shadow-sm backdrop-blur">
                {compactNumber(detail.project.trace_volume_24h)} traces in 24h
              </div>
              <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] ${riskTone(detail.project.risk_level)}`}>
                {detail.project.risk_level} risk
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 lg:grid-cols-4">
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <Workflow className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Trace volume</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{compactNumber(detail.project.trace_volume_24h)}</p>
            <p className="mt-2 text-sm text-steel">Warehouse traces in the current 24-hour summary window.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <ShieldAlert className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Guardrail rate</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{(detail.project.guardrail_rate * 100).toFixed(1)}%</p>
            <p className="mt-2 text-sm text-steel">Runtime guardrail triggers relative to warehouse trace volume.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Incident rate</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{(detail.project.incident_rate * 100).toFixed(2)}%</p>
            <p className="mt-2 text-sm text-steel">Detected incidents relative to trace volume in the same window.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <Boxes className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Pipeline lag</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{compactNumber(detail.project.pipeline_lag)}</p>
            <p className="mt-2 text-sm text-steel">Approximate backlog from ingest versus warehouse/event processing.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="space-y-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Trace volume chart</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Seven-day warehouse throughput</h2>
              </div>
              <p className="text-sm text-steel">{detail.trace_volume_chart.length} UTC days</p>
            </div>
            <div className="mt-8 grid h-64 grid-cols-7 items-end gap-3">
              {detail.trace_volume_chart.map((point, index) => (
                <div key={point.date} className="flex h-full flex-col justify-end gap-3">
                  <div className="text-center text-xs font-medium text-ink">{compactNumber(point.trace_volume)}</div>
                  <div
                    className={`rounded-t-[18px] ${
                      index === detail.trace_volume_chart.length - 1
                        ? "bg-[linear-gradient(180deg,#0f172a,#334155)]"
                        : "bg-zinc-300"
                    }`}
                    style={{
                      height: `${Math.max((point.trace_volume / chartMax) * 100, point.trace_volume > 0 ? 8 : 0)}%`,
                    }}
                  />
                  <div className="text-center text-[11px] uppercase tracking-[0.16em] text-steel">
                    {new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Guardrail triggers</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Recent interventions</h2>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {detail.guardrail_triggers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-5 text-sm text-steel">
                  No runtime guardrail triggers recorded for this project yet.
                </div>
              ) : (
                detail.guardrail_triggers.map((item) => (
                  <div key={`${item.created_at}-${item.policy_type}`} className="rounded-2xl border border-zinc-200 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink">{item.policy_type}</p>
                      <span className="text-xs uppercase tracking-[0.16em] text-steel">{item.action_taken}</span>
                    </div>
                    <p className="mt-2 text-sm text-steel">
                      {item.provider_model ?? "unknown model"} · {item.latency_ms ?? 0} ms ·{" "}
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Incident history</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Recent reliability incidents</h2>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {detail.incident_history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-5 text-sm text-steel">
                  No incidents recorded for this project in the current operator scope.
                </div>
              ) : (
                detail.incident_history.map((incident) => (
                  <div key={incident.incident_id} className="rounded-2xl border border-zinc-200 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink">{incident.title}</p>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${severityTone(incident.severity)}`}>
                        {incident.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-steel">
                      {incident.status} · started {new Date(incident.started_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <GitCommitHorizontal className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Deployment changes</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Recent rollout context</h2>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {detail.deployment_changes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-5 text-sm text-steel">
                  No deployment records found for this project.
                </div>
              ) : (
                detail.deployment_changes.map((deployment) => (
                  <div key={deployment.deployment_id} className="rounded-2xl border border-zinc-200 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink">{deployment.environment}</p>
                      <span className="text-xs uppercase tracking-[0.16em] text-steel">{deployment.deployed_by ?? "unknown"}</span>
                    </div>
                    <p className="mt-2 text-sm text-steel">{new Date(deployment.deployed_at).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <Boxes className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Processor failures</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">External processor instability</h2>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {detail.processor_failures.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-5 text-sm text-steel">
                  No external processor failures recorded in the recent window.
                </div>
              ) : (
                detail.processor_failures.map((failure) => (
                  <div key={failure.failure_id} className="rounded-2xl border border-zinc-200 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink">{failure.processor_name}</p>
                      <span className="text-xs uppercase tracking-[0.16em] text-steel">{failure.event_type}</span>
                    </div>
                    <p className="mt-2 text-sm text-steel">
                      {failure.attempts} attempts · {failure.last_error} · {new Date(failure.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Recent signals</p>
            <div className="mt-5 space-y-3">
              {detail.recent_timeline.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-5 text-sm text-secondary">
                  No timeline events have been recorded for this project yet.
                </div>
              ) : (
                detail.recent_timeline.map((event, index) => (
                  <div key={`${event.timestamp}-${index}`} className="rounded-2xl border border-default bg-surface-elevated px-4 py-4">
                    <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em]">
                      <span className={`font-semibold ${timelinePrefixTone(event.event_type)}`}>
                        {timelinePrefix(event.event_type)}
                      </span>
                      <span className="text-secondary">{new Date(event.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-primary">{event.title}</p>
                    <p className="mt-1 text-sm leading-6 text-secondary">{emphasizeNumbers(event.summary)}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
