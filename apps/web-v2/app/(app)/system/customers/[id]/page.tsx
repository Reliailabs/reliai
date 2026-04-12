import Link from "next/link";
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
  if (riskLevel === "high") return "bg-red-500/10 text-red-400 border border-red-500/20";
  if (riskLevel === "medium") return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
  return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
}

function severityTone(severity: string) {
  if (severity === "critical") return "bg-red-500/10 text-red-400 border border-red-500/20";
  if (severity === "high") return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
  if (severity === "medium") return "bg-sky-500/10 text-sky-400 border border-sky-500/20";
  return "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20";
}

function maxPoint(points: { trace_volume: number }[]) {
  return Math.max(...points.map((point) => point.trace_volume), 1);
}

export default async function SystemCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getSystemCustomerDetail(id).catch((error: Error) => {
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
      <header className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-6 py-6">
          <Link href="/system/customers" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300">
            <ArrowLeft className="h-4 w-4" />
            Back to customer health
          </Link>
          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Customer drilldown</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">{detail.project.project_name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
                Project-level operational readout combining warehouse trace volume, runtime guardrails, incident
                history, deployment changes, and processor failures.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100">
                {compactNumber(detail.project.trace_volume_24h)} traces in 24h
              </div>
              <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] ${riskTone(detail.project.risk_level)}`}>
                {detail.project.risk_level} risk
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 lg:grid-cols-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4">
            <div className="flex items-center gap-2 text-zinc-500">
              <Workflow className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Trace volume</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-zinc-100">{compactNumber(detail.project.trace_volume_24h)}</p>
            <p className="mt-2 text-sm text-zinc-500">Warehouse traces in the current 24-hour summary window.</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4">
            <div className="flex items-center gap-2 text-zinc-500">
              <ShieldAlert className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Guardrail rate</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-zinc-100">{(detail.project.guardrail_rate * 100).toFixed(1)}%</p>
            <p className="mt-2 text-sm text-zinc-500">Runtime guardrail triggers relative to warehouse trace volume.</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4">
            <div className="flex items-center gap-2 text-zinc-500">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Incident rate</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-zinc-100">{(detail.project.incident_rate * 100).toFixed(2)}%</p>
            <p className="mt-2 text-sm text-zinc-500">Detected incidents relative to trace volume in the same window.</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4">
            <div className="flex items-center gap-2 text-zinc-500">
              <Boxes className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Pipeline lag</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-zinc-100">{compactNumber(detail.project.pipeline_lag)}</p>
            <p className="mt-2 text-sm text-zinc-500">Approximate backlog from ingest versus warehouse/event processing.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="space-y-6">
          <Card className="rounded-lg border-zinc-800 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Trace volume chart</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Seven-day warehouse throughput</h2>
              </div>
              <p className="text-sm text-zinc-500">{detail.trace_volume_chart.length} UTC days</p>
            </div>
            <div className="mt-8 grid h-64 grid-cols-7 items-end gap-3">
              {detail.trace_volume_chart.map((point, index) => (
                <div key={point.date} className="flex h-full flex-col justify-end gap-3">
                  <div className="text-center text-xs font-medium text-zinc-100">{compactNumber(point.trace_volume)}</div>
                  <div
                    className={`rounded-t-[18px] ${
                      index === detail.trace_volume_chart.length - 1
                        ? "bg-blue-500"
                        : "bg-zinc-700"
                    }`}
                    style={{
                      height: `${Math.max((point.trace_volume / chartMax) * 100, point.trace_volume > 0 ? 8 : 0)}%`,
                    }}
                  />
                  <div className="text-center text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    {new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-lg border-zinc-800 p-6">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-zinc-500" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Guardrail triggers</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Recent interventions</h2>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {detail.guardrail_triggers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-500">
                  No runtime guardrail triggers recorded for this project yet.
                </div>
              ) : (
                detail.guardrail_triggers.map((item) => (
                  <div key={`${item.created_at}-${item.policy_type}`} className="rounded-2xl border border-zinc-800 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-100">{item.policy_type}</p>
                      <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">{item.action_taken}</span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">
                      {item.provider_model ?? "unknown model"} · {item.latency_ms ?? 0} ms ·{" "}
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="rounded-lg border-zinc-800 p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-zinc-500" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Incident history</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Recent reliability incidents</h2>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {detail.incident_history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-500">
                  No incidents recorded for this project in the current operator scope.
                </div>
              ) : (
                detail.incident_history.map((incident) => (
                  <div key={incident.incident_id} className="rounded-2xl border border-zinc-800 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-100">{incident.title}</p>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${severityTone(incident.severity)}`}>
                        {incident.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">
                      {incident.status} · started {new Date(incident.started_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-lg border-zinc-800 p-6">
            <div className="flex items-center gap-3">
              <GitCommitHorizontal className="h-5 w-5 text-zinc-500" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Deployment changes</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Recent rollout context</h2>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {detail.deployment_changes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-500">
                  No deployment records found for this project.
                </div>
              ) : (
                detail.deployment_changes.map((deployment) => (
                  <div key={deployment.deployment_id} className="rounded-2xl border border-zinc-800 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-100">{deployment.environment}</p>
                      <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">{deployment.deployed_by ?? "unknown"}</span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">{new Date(deployment.deployed_at).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="rounded-lg border-zinc-800 p-6">
            <div className="flex items-center gap-3">
              <Boxes className="h-5 w-5 text-zinc-500" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Processor failures</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-100">External processor instability</h2>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {detail.processor_failures.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-500">
                  No external processor failures recorded in the recent window.
                </div>
              ) : (
                detail.processor_failures.map((failure) => (
                  <div key={failure.failure_id} className="rounded-2xl border border-zinc-800 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-100">{failure.processor_name}</p>
                      <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">{failure.event_type}</span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">
                      {failure.attempts} attempts · {failure.last_error} · {new Date(failure.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="rounded-lg border-zinc-800 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Recent signals</p>
            <div className="mt-5 space-y-3">
              {detail.recent_timeline.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-5 text-sm text-zinc-500">
                  No timeline events have been recorded for this project yet.
                </div>
              ) : (
                detail.recent_timeline.map((event, index) => (
                  <div key={`${event.timestamp}-${index}`} className="rounded-2xl border border-zinc-800 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-zinc-100">{event.title}</p>
                      <span className="text-xs uppercase tracking-[0.16em] text-zinc-500">{event.event_type}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">{event.summary}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
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