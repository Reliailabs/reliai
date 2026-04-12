import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, GitCompareArrows, ShieldAlert, Wrench } from "lucide-react";

import { Card } from "@/components/ui/card";
import { RecommendationCallout } from "@/components/ui/recommendation-callout";
import { getIncidentInvestigation } from "@/lib/api";

function formatDate(value: string | null | undefined) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString();
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function severityTone(severity: string) {
  if (severity === "critical") return "bg-red-500/10 text-red-400 border border-red-500/20";
  if (severity === "high") return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
  if (severity === "medium") return "bg-orange-500/10 text-orange-400 border border-orange-500/20";
  return "bg-zinc-9000/10 text-zinc-400 border border-zinc-500/20";
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
      <header className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-6 shadow-sm">
        <Link href={`/incidents/${incidentId}`} className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100">
          <ArrowLeft className="h-4 w-4" />
          Back to incident
        </Link>
        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Incident investigation</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">{incident.title}</h1>
            <p className="mt-2 text-sm text-zinc-500">
              {incident.project_name} · {String(incident.summary_json.metric_name ?? "metric n/a")} · opened {formatDate(incident.started_at)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${severityTone(incident.severity)}`}>
              {incident.severity}
            </span>
            <Link href={`/incidents/${incident.id}/command`} className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-900">
              Open command center
              <ShieldAlert className="h-4 w-4" />
            </Link>
            <a href={investigation.trace_comparison.compare_link} className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-900">
              Compare traces
              <GitCompareArrows className="h-4 w-4" />
            </a>
            {investigation.deployment_context.deployment_link ? (
              <a href={investigation.deployment_context.deployment_link} className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-900">
                View deployment
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-4">
        <Card className="rounded-lg border-zinc-800 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Incident summary</p>
          <p className="mt-3 text-sm text-zinc-400">Scope</p>
          <p className="mt-2 text-xl font-semibold text-zinc-100">
            {String(incident.summary_json.scope_type ?? "n/a")}:{String(incident.summary_json.scope_id ?? "n/a")}
          </p>
        </Card>
        <Card className="rounded-lg border-zinc-800 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Metric impact</p>
          <p className="mt-3 text-sm text-zinc-400">Current vs baseline</p>
          <p className="mt-2 text-xl font-semibold text-zinc-100">
            {incident.regressions[0] ? `${incident.regressions[0].current_value} vs ${incident.regressions[0].baseline_value}` : "n/a"}
          </p>
        </Card>
        <Card className="rounded-lg border-zinc-800 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Timeline</p>
          <p className="mt-3 text-sm text-zinc-400">Current window</p>
          <p className="mt-2 text-lg font-semibold text-zinc-100">{incident.compare.current_window_start ?? "n/a"}</p>
          <p className="mt-1 text-sm text-zinc-400">{incident.compare.current_window_end ?? "n/a"}</p>
        </Card>
        <RecommendationCallout
          label="Recommendation"
          recommendation={
            investigation.recommendations[0]?.recommended_action ??
            investigation.root_cause_analysis.recommended_fix.summary
          }
          supporting="Review ranked causes before taking mitigation action."
          className="rounded-lg"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_420px]">
        <Card className="rounded-lg border-zinc-800 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Root cause</p>
          <div className="mt-4 space-y-3">
            {investigation.root_cause_analysis.ranked_causes.map((cause) => (
              <div key={cause.cause_type} className="rounded-lg border border-zinc-800 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-zinc-100">{cause.label}</p>
                  <p className="text-sm font-medium text-zinc-100">{percent(cause.probability)}</p>
                </div>
                <p className="mt-1 text-sm text-zinc-400">{cause.cause_type.replaceAll("_", " ")}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-lg border-zinc-800 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Suggested fix</p>
          <div className="mt-4 space-y-3">
            {investigation.recommendations.length > 0 ? (
              investigation.recommendations.map((item, index) => (
                <RecommendationCallout
                  key={`${item.recommendation_id ?? item.recommended_action}-${index}`}
                  recommendation={item.recommended_action}
                  supporting={String(item.supporting_evidence.description ?? "No recommendation description available.")}
                />
              ))
            ) : (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4 text-sm text-zinc-400">
                No deterministic recommendation matched this incident. Review the ranked causes and trace deltas first.
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="rounded-lg border-zinc-800 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Trace comparison</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 px-4 py-4">
              <p className="text-sm font-medium text-zinc-100">Failing trace</p>
              {investigation.trace_comparison.failing_trace_summary ? (
                <div className="mt-2 space-y-1 text-sm text-zinc-400">
                  <p>{investigation.trace_comparison.failing_trace_summary.request_id}</p>
                  <p>{investigation.trace_comparison.failing_trace_summary.model_name} · {investigation.trace_comparison.failing_trace_summary.prompt_version ?? "prompt n/a"}</p>
                  <p>{investigation.trace_comparison.failing_trace_summary.latency_ms !== null ? `${investigation.trace_comparison.failing_trace_summary.latency_ms} ms` : "latency n/a"}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-400">No failing trace summary available.</p>
              )}
            </div>
            <div className="rounded-lg border border-zinc-800 px-4 py-4">
              <p className="text-sm font-medium text-zinc-100">Baseline trace</p>
              {investigation.trace_comparison.baseline_trace_summary ? (
                <div className="mt-2 space-y-1 text-sm text-zinc-400">
                  <p>{investigation.trace_comparison.baseline_trace_summary.request_id}</p>
                  <p>{investigation.trace_comparison.baseline_trace_summary.model_name} · {investigation.trace_comparison.baseline_trace_summary.prompt_version ?? "prompt n/a"}</p>
                  <p>{investigation.trace_comparison.baseline_trace_summary.latency_ms !== null ? `${investigation.trace_comparison.baseline_trace_summary.latency_ms} ms` : "latency n/a"}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-400">No baseline trace summary available.</p>
              )}
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {investigation.trace_comparison.key_differences.map((item) => (
              <div key={`${item.dimension}-${item.title}`} className="rounded-lg border border-zinc-800 px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">{item.title}</p>
                <p className="mt-1 text-sm text-zinc-400">
                  Current · {item.current_value ?? "n/a"} | Baseline · {item.baseline_value ?? "n/a"}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-lg border-zinc-800 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Deployment context</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-zinc-800 px-4 py-3">
              <p className="text-sm font-medium text-zinc-100">Recent deployment</p>
              <p className="mt-1 text-sm text-zinc-400">
                {investigation.deployment_context.deployment ? formatDate(investigation.deployment_context.deployment.deployment.deployed_at) : "No deployment linked"}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 px-4 py-3">
              <p className="text-sm font-medium text-zinc-100">Risk score</p>
              <p className="mt-1 text-sm text-zinc-400">
                {investigation.deployment_context.latest_risk_score ? `${investigation.deployment_context.latest_risk_score.risk_score} · ${investigation.deployment_context.latest_risk_score.risk_level}` : "No deployment risk score"}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 px-4 py-3">
              <p className="text-sm font-medium text-zinc-100">Simulation results</p>
              <p className="mt-1 text-sm text-zinc-400">
                {investigation.deployment_context.latest_simulation ? `${investigation.deployment_context.latest_simulation.risk_level ?? "n/a"} · ${investigation.deployment_context.latest_simulation.predicted_failure_rate ?? "n/a"} predicted failure` : "No simulation available"}
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-lg border-zinc-800 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">AI investigation insights</p>
          <div className="mt-4 space-y-3">
            {investigation.possible_root_causes.length > 0 ? (
              investigation.possible_root_causes.map((item, index) => (
                <div key={`${String(item.type)}-${String(item.pattern)}-${index}`} className="rounded-lg border border-zinc-800 px-4 py-3">
                  <p className="text-sm font-medium text-zinc-100">{String(item.pattern).replaceAll("_", " ")}</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {String(item.type).replaceAll("_", " ")} · {percent(Number(item.confidence ?? 0))}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900 px-4 py-4 text-sm text-zinc-400">
                No graph-derived investigation hints are available for this incident yet.
              </div>
            )}
          </div>
        </Card>

        <Card className="rounded-lg border-zinc-800 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Guardrail activity</p>
          {investigation.guardrail_activity.length > 0 ? (
            <div className="mt-4 space-y-3">
              {investigation.guardrail_activity.map((item) => (
                <div key={item.policy_type} className="rounded-lg border border-zinc-800 px-4 py-3">
                  <p className="text-sm font-medium text-zinc-100">{item.policy_type}</p>
                  <p className="mt-1 text-sm text-zinc-400">{item.trigger_count} triggers · last {formatDate(item.last_trigger_time)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-zinc-800 bg-zinc-900 px-4 py-4 text-sm text-zinc-400">
              No recent runtime guardrail triggers were tied to this incident window.
            </div>
          )}
        </Card>

        <Card className="rounded-lg border-zinc-800 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Recommended next step</p>
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4">
            <div className="flex items-start gap-3">
              <Wrench className="mt-0.5 h-4 w-4 text-zinc-400" />
              <div>
                <p className="text-sm font-medium text-zinc-100">{investigation.root_cause_analysis.recommended_fix.summary}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
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