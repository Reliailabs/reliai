import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, GitCompareArrows, ShieldAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getIncidentCommandCenter, getProjectRecommendations } from "@/lib/api";

function severityTone(severity: string) {
  if (severity === "critical") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (severity === "high") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  if (severity === "medium") return "bg-orange-100 text-orange-800 ring-1 ring-orange-200";
  return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString();
}

function renderProbability(value: number) {
  return `${Math.round(value * 100)}%`;
}

function renderSignalLink(metadata: Record<string, unknown> | null) {
  const path = typeof metadata?.path === "string" ? metadata.path : null;
  if (!path) return null;
  return (
    <a href={path} className="inline-flex items-center gap-1 text-sm font-medium text-ink underline-offset-4 hover:underline">
      Open
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function findSuggestedFix(
  recommendations: Awaited<ReturnType<typeof getProjectRecommendations>>,
  incidentType: string,
  metricName: string | null,
) {
  return (
    recommendations.find((recommendation) => {
      const relatedIncidentTypes = Array.isArray(recommendation.evidence_json.related_incident_types)
        ? recommendation.evidence_json.related_incident_types
        : [];
      const recommendationMetric =
        typeof recommendation.evidence_json.metric_name === "string"
          ? recommendation.evidence_json.metric_name
          : null;
      return (
        relatedIncidentTypes.includes(incidentType) ||
        (metricName !== null && recommendationMetric === metricName)
      );
    }) ?? null
  );
}

export default async function IncidentCommandCenterPage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  const command = await getIncidentCommandCenter(incidentId).catch(() => null);

  if (!command) {
    notFound();
  }

  const incident = command.incident;
  const recommendations = await getProjectRecommendations(incident.project_id).catch(() => []);
  const suggestedFix = findSuggestedFix(
    recommendations,
    incident.incident_type,
    typeof incident.summary_json.metric_name === "string" ? incident.summary_json.metric_name : null,
  );

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-zinc-300 bg-white px-6 py-6 shadow-sm">
        <Link
          href={`/incidents/${incidentId}`}
          className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to incident
        </Link>
        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Incident command center</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{incident.title}</h1>
            <p className="mt-2 text-sm text-steel">
              {incident.project_name} · {String(incident.summary_json.metric_name ?? "metric n/a")} · opened{" "}
              {formatDate(incident.started_at)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${severityTone(incident.severity)}`}>
              {incident.severity}
            </span>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                incident.status === "open" ? "bg-ink text-white" : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200"
              }`}
            >
              {incident.status}
            </span>
            <Link
              href={`/incidents/${incident.id}/investigate`}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-zinc-50"
            >
              Investigate
              <ShieldAlert className="h-4 w-4" />
            </Link>
            <a
              href={command.trace_compare.compare_link}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-zinc-50"
            >
              Open trace compare
              <GitCompareArrows className="h-4 w-4" />
            </a>
            {command.deployment_context ? (
              <Link
                href={`/deployments/${command.deployment_context.deployment.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-zinc-50"
              >
                View deployment
                <ExternalLink className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-steel">Incident status</p>
          <div className="mt-4 space-y-2 text-sm text-steel">
            <p><span className="font-medium text-ink">Scope</span> · {String(incident.summary_json.scope_type ?? "n/a")}:{String(incident.summary_json.scope_id ?? "n/a")}</p>
            <p><span className="font-medium text-ink">Window</span> · {String(incident.summary_json.window_minutes ?? "n/a")} min</p>
            <p><span className="font-medium text-ink">Owner</span> · {incident.owner_operator_email ?? "unassigned"}</p>
            <p><span className="font-medium text-ink">Ack</span> · {formatDate(incident.acknowledged_at)}</p>
          </div>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-steel">Deployment context</p>
          {command.deployment_context ? (
            <div className="mt-4 space-y-2 text-sm text-steel">
              <p><span className="font-medium text-ink">Environment</span> · {command.deployment_context.deployment.environment}</p>
              <p><span className="font-medium text-ink">Deployed</span> · {formatDate(command.deployment_context.deployment.deployed_at)}</p>
              <p><span className="font-medium text-ink">Time to incident</span> · {command.deployment_context.time_since_deployment_minutes} min</p>
              <p><span className="font-medium text-ink">Prompt</span> · {command.deployment_context.prompt_version?.version ?? "n/a"}</p>
              <p><span className="font-medium text-ink">Model</span> · {command.deployment_context.model_version?.model_name ?? "n/a"}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-steel">No deployment was linked to this incident window.</p>
          )}
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-steel">Guardrail activity</p>
          {command.guardrail_activity.length > 0 ? (
            <div className="mt-4 space-y-3">
              {command.guardrail_activity.map((item) => (
                <div key={item.policy_type} className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-steel">
                  <p className="font-medium text-ink">{item.policy_type}</p>
                  <p className="mt-1">{item.trigger_count} triggers</p>
                  <p className="mt-1">Last trigger · {formatDate(item.last_trigger_time)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-steel">No runtime guardrail triggers were recorded for this project.</p>
          )}
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Root cause</p>
          <div className="mt-4 space-y-3">
            {command.root_cause.root_cause_probabilities.map((item) => (
              <div key={item.cause_type} className="rounded-2xl border border-zinc-200 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-ink">{item.label}</p>
                  <p className="text-sm font-medium text-ink">{renderProbability(item.probability)}</p>
                </div>
                <p className="mt-1 text-sm text-steel">{item.cause_type.replaceAll("_", " ")}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-steel">
            <p className="font-medium text-ink">Recommended fix</p>
            <p className="mt-1">{command.root_cause.recommended_fix.summary}</p>
          </div>
          {suggestedFix ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <p className="font-medium text-ink">Suggested fix</p>
              <p className="mt-1 font-medium">{suggestedFix.title}</p>
              <p className="mt-2 leading-6">{suggestedFix.description}</p>
            </div>
          ) : null}
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Trace comparison</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <p className="text-sm font-medium text-ink">Failing trace</p>
              {command.trace_compare.failing_trace_summary ? (
                <div className="mt-2 space-y-1 text-sm text-steel">
                  <p>{command.trace_compare.failing_trace_summary.request_id}</p>
                  <p>
                    {command.trace_compare.failing_trace_summary.model_name} ·{" "}
                    {command.trace_compare.failing_trace_summary.prompt_version ?? "prompt n/a"} ·{" "}
                    {command.trace_compare.failing_trace_summary.success
                      ? "success"
                      : command.trace_compare.failing_trace_summary.error_type ?? "failure"}
                  </p>
                  <p>
                    {command.trace_compare.failing_trace_summary.latency_ms !== null
                      ? `${command.trace_compare.failing_trace_summary.latency_ms} ms`
                      : "latency n/a"}{" "}
                    · {command.trace_compare.failing_trace_summary.total_cost_usd ?? "cost n/a"}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-steel">No trace available.</p>
              )}
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <p className="text-sm font-medium text-ink">Baseline trace</p>
              {command.trace_compare.baseline_trace_summary ? (
                <div className="mt-2 space-y-1 text-sm text-steel">
                  <p>{command.trace_compare.baseline_trace_summary.request_id}</p>
                  <p>
                    {command.trace_compare.baseline_trace_summary.model_name} ·{" "}
                    {command.trace_compare.baseline_trace_summary.prompt_version ?? "prompt n/a"} ·{" "}
                    {command.trace_compare.baseline_trace_summary.success
                      ? "success"
                      : command.trace_compare.baseline_trace_summary.error_type ?? "failure"}
                  </p>
                  <p>
                    {command.trace_compare.baseline_trace_summary.latency_ms !== null
                      ? `${command.trace_compare.baseline_trace_summary.latency_ms} ms`
                      : "latency n/a"}{" "}
                    · {command.trace_compare.baseline_trace_summary.total_cost_usd ?? "cost n/a"}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-steel">No trace available.</p>
              )}
            </div>
          </div>
          <a
            href={command.trace_compare.compare_link}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ink underline-offset-4 hover:underline"
          >
            Open compare
            <ExternalLink className="h-4 w-4" />
          </a>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Related regressions</p>
          {command.related_regressions.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead className="bg-zinc-50 text-xs uppercase tracking-[0.18em] text-steel">
                  <tr>
                    <th className="px-4 py-3 font-medium">Metric</th>
                    <th className="px-4 py-3 font-medium">Current</th>
                    <th className="px-4 py-3 font-medium">Baseline</th>
                    <th className="px-4 py-3 font-medium">Detected</th>
                  </tr>
                </thead>
                <tbody>
                  {command.related_regressions.map((item) => (
                    <tr key={item.id} className="border-t border-zinc-200">
                      <td className="px-4 py-3 text-sm font-medium text-ink">
                        <Link href={`/regressions/${item.id}`} className="underline-offset-4 hover:underline">
                          {item.metric_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-steel">{item.current_value}</td>
                      <td className="px-4 py-3 text-sm text-steel">{item.baseline_value}</td>
                      <td className="px-4 py-3 text-sm text-steel">{formatDate(item.detected_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-steel">No related regressions were found for this incident scope.</p>
          )}
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Recent signals</p>
          <div className="mt-4 space-y-3">
            {command.recent_signals.length > 0 ? (
              command.recent_signals.map((item, index) => (
                <div key={`${item.event_type}-${index}-${item.timestamp}`} className="rounded-2xl border border-zinc-200 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink">{item.title}</p>
                      <p className="mt-1 text-sm text-steel">{item.summary}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-steel">
                        {item.event_type.replaceAll("_", " ")} · {formatDate(item.timestamp)}
                      </p>
                    </div>
                    {item.severity ? (
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${severityTone(item.severity)}`}>
                        {item.severity}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3">{renderSignalLink(item.metadata)}</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-5 text-sm text-steel">
                <ShieldAlert className="mb-2 h-4 w-4 text-steel" />
                No adjacent deployment, guardrail, or regression signals were found around this incident.
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
