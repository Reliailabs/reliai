import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, GitCompareArrows, ShieldAlert, Wrench } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getIncidentInvestigation } from "@/lib/api";

function formatDate(value: string | null | undefined) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString();
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function severityTone(severity: string) {
  if (severity === "critical") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (severity === "high") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  if (severity === "medium") return "bg-orange-100 text-orange-800 ring-1 ring-orange-200";
  return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
}

export default async function IncidentInvestigationPage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  const investigation = await getIncidentInvestigation(incidentId).catch(() => null);

  if (!investigation) {
    notFound();
  }

  const incident = investigation.incident;

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-zinc-300 bg-white px-6 py-6 shadow-sm">
        <Link href={`/incidents/${incidentId}`} className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          Back to incident
        </Link>
        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Incident investigation</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{incident.title}</h1>
            <p className="mt-2 text-sm text-steel">
              {incident.project_name} · {String(incident.summary_json.metric_name ?? "metric n/a")} · opened {formatDate(incident.started_at)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${severityTone(incident.severity)}`}>
              {incident.severity}
            </span>
            <Link href={`/incidents/${incident.id}/command`} className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-zinc-50">
              Open command center
              <ShieldAlert className="h-4 w-4" />
            </Link>
            <a href={investigation.trace_comparison.compare_link} className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-zinc-50">
              Compare traces
              <GitCompareArrows className="h-4 w-4" />
            </a>
            {investigation.deployment_context.deployment_link ? (
              <a href={investigation.deployment_context.deployment_link} className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-zinc-50">
                View deployment
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-4">
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-steel">Incident summary</p>
          <p className="mt-3 text-sm text-steel">Scope</p>
          <p className="mt-2 text-xl font-semibold text-ink">
            {String(incident.summary_json.scope_type ?? "n/a")}:{String(incident.summary_json.scope_id ?? "n/a")}
          </p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-steel">Metric impact</p>
          <p className="mt-3 text-sm text-steel">Current vs baseline</p>
          <p className="mt-2 text-xl font-semibold text-ink">
            {incident.regressions[0] ? `${incident.regressions[0].current_value} vs ${incident.regressions[0].baseline_value}` : "n/a"}
          </p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-steel">Timeline</p>
          <p className="mt-3 text-sm text-steel">Current window</p>
          <p className="mt-2 text-lg font-semibold text-ink">{incident.compare.current_window_start ?? "n/a"}</p>
          <p className="mt-1 text-sm text-steel">{incident.compare.current_window_end ?? "n/a"}</p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-steel">Suggested fix</p>
          <p className="mt-3 text-sm text-steel">Top action</p>
          <p className="mt-2 text-lg font-semibold text-ink">
            {investigation.recommendations[0]?.recommended_action ?? investigation.root_cause_analysis.recommended_fix.summary}
          </p>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_420px]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Root cause</p>
          <div className="mt-4 space-y-3">
            {investigation.root_cause_analysis.ranked_causes.map((cause) => (
              <div key={cause.cause_type} className="rounded-2xl border border-zinc-200 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-ink">{cause.label}</p>
                  <p className="text-sm font-medium text-ink">{percent(cause.probability)}</p>
                </div>
                <p className="mt-1 text-sm text-steel">{cause.cause_type.replaceAll("_", " ")}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Suggested fix</p>
          <div className="mt-4 space-y-3">
            {investigation.recommendations.length > 0 ? (
              investigation.recommendations.map((item) => (
                <div key={`${item.recommendation_id ?? item.recommended_action}`} className="rounded-2xl border border-zinc-200 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-ink">{item.recommended_action}</p>
                      <p className="mt-2 text-sm leading-6 text-steel">
                        {String(item.supporting_evidence.description ?? "No recommendation description available.")}
                      </p>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
                      {percent(item.confidence)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-4 text-sm text-steel">
                No deterministic recommendation matched this incident. Review the ranked causes and trace deltas first.
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Trace comparison</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 px-4 py-4">
              <p className="text-sm font-medium text-ink">Failing trace</p>
              {investigation.trace_comparison.failing_trace_summary ? (
                <div className="mt-2 space-y-1 text-sm text-steel">
                  <p>{investigation.trace_comparison.failing_trace_summary.request_id}</p>
                  <p>{investigation.trace_comparison.failing_trace_summary.model_name} · {investigation.trace_comparison.failing_trace_summary.prompt_version ?? "prompt n/a"}</p>
                  <p>{investigation.trace_comparison.failing_trace_summary.latency_ms !== null ? `${investigation.trace_comparison.failing_trace_summary.latency_ms} ms` : "latency n/a"}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-steel">No failing trace summary available.</p>
              )}
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-4">
              <p className="text-sm font-medium text-ink">Baseline trace</p>
              {investigation.trace_comparison.baseline_trace_summary ? (
                <div className="mt-2 space-y-1 text-sm text-steel">
                  <p>{investigation.trace_comparison.baseline_trace_summary.request_id}</p>
                  <p>{investigation.trace_comparison.baseline_trace_summary.model_name} · {investigation.trace_comparison.baseline_trace_summary.prompt_version ?? "prompt n/a"}</p>
                  <p>{investigation.trace_comparison.baseline_trace_summary.latency_ms !== null ? `${investigation.trace_comparison.baseline_trace_summary.latency_ms} ms` : "latency n/a"}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-steel">No baseline trace summary available.</p>
              )}
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {investigation.trace_comparison.key_differences.map((item) => (
              <div key={`${item.dimension}-${item.title}`} className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="text-sm font-medium text-ink">{item.title}</p>
                <p className="mt-1 text-sm text-steel">
                  Current · {item.current_value ?? "n/a"} | Baseline · {item.baseline_value ?? "n/a"}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Deployment context</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <p className="text-sm font-medium text-ink">Recent deployment</p>
              <p className="mt-1 text-sm text-steel">
                {investigation.deployment_context.deployment ? formatDate(investigation.deployment_context.deployment.deployment.deployed_at) : "No deployment linked"}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <p className="text-sm font-medium text-ink">Risk score</p>
              <p className="mt-1 text-sm text-steel">
                {investigation.deployment_context.latest_risk_score ? `${investigation.deployment_context.latest_risk_score.risk_score} · ${investigation.deployment_context.latest_risk_score.risk_level}` : "No deployment risk score"}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <p className="text-sm font-medium text-ink">Simulation results</p>
              <p className="mt-1 text-sm text-steel">
                {investigation.deployment_context.latest_simulation ? `${investigation.deployment_context.latest_simulation.risk_level ?? "n/a"} · ${investigation.deployment_context.latest_simulation.predicted_failure_rate ?? "n/a"} predicted failure` : "No simulation available"}
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Guardrail activity</p>
          {investigation.guardrail_activity.length > 0 ? (
            <div className="mt-4 space-y-3">
              {investigation.guardrail_activity.map((item) => (
                <div key={item.policy_type} className="rounded-2xl border border-zinc-200 px-4 py-3">
                  <p className="text-sm font-medium text-ink">{item.policy_type}</p>
                  <p className="mt-1 text-sm text-steel">{item.trigger_count} triggers · last {formatDate(item.last_trigger_time)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-4 text-sm text-steel">
              No recent runtime guardrail triggers were tied to this incident window.
            </div>
          )}
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Recommended next step</p>
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <div className="flex items-start gap-3">
              <Wrench className="mt-0.5 h-4 w-4 text-steel" />
              <div>
                <p className="text-sm font-medium text-ink">{investigation.root_cause_analysis.recommended_fix.summary}</p>
                <p className="mt-2 text-sm leading-6 text-steel">
                  Use the command center for surrounding signals, then open the compare view or deployment page to validate the likely fix before changing production traffic.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
