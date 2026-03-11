import Link from "next/link";
import { ArrowLeft, ExternalLink, GitCompareArrows, ShieldAlert, Sparkles } from "lucide-react";

import type { IncidentCommandCenterRead } from "@reliai/types";

import { Card } from "@/components/ui/card";
import { formatTime, renderProbability, severityTone } from "@/components/presenters/ops-format";
import { cn } from "@/lib/utils";

interface SuggestedFix {
  title: string;
  description: string;
}

function renderSignalLink(metadata: Record<string, unknown> | null, screenshotMode: boolean) {
  const path = typeof metadata?.path === "string" ? metadata.path : null;
  if (!path || screenshotMode) return null;
  return (
    <a href={path} className="inline-flex items-center gap-1 text-sm font-medium text-ink underline-offset-4 hover:underline">
      Open
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

interface IncidentCommandCenterViewProps {
  incidentId: string;
  command: IncidentCommandCenterRead;
  suggestedFix?: SuggestedFix | null;
  screenshotMode?: boolean;
}

export function IncidentCommandCenterView({
  incidentId,
  command,
  suggestedFix = null,
  screenshotMode = false,
}: IncidentCommandCenterViewProps) {
  const incident = command.incident;

  return (
    <div className={cn("space-y-6", screenshotMode && "mx-auto w-[1600px] max-w-[1600px] space-y-5 overflow-hidden bg-white p-8")}>
      <header className="rounded-[28px] border border-zinc-300 bg-white px-6 py-6 shadow-sm">
        {!screenshotMode ? (
          <Link
            href={`/incidents/${incidentId}`}
            className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to incident
          </Link>
        ) : (
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Reliai incident command center</p>
        )}
        <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Incident command center</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{incident.title}</h1>
            <p className="mt-2 text-sm text-steel">
              {incident.project_name} · {String(incident.summary_json.metric_name ?? "metric n/a")} · opened{" "}
              {formatTime(incident.started_at, screenshotMode)}
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
            {!screenshotMode ? (
              <>
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
              </>
            ) : null}
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-steel" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Likely root cause</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">What probably broke</h2>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4">
              <p className="text-sm font-medium text-ink">
                {command.root_cause.root_cause_probabilities[0]?.label ?? "No dominant signal yet"}
              </p>
              <p className="mt-1 text-sm text-steel">
                Confidence {renderProbability(command.root_cause.root_cause_probabilities[0]?.probability ?? 0)}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Graph related patterns</p>
                <div className="mt-3 space-y-2 text-sm text-steel">
                  {command.possible_root_causes.length > 0 ? (
                    command.possible_root_causes.slice(0, 3).map((item, index) => (
                      <p key={`${String(item.pattern ?? index)}-${index}`}>
                        {String(item.pattern ?? "Unknown pattern")}
                      </p>
                    ))
                  ) : (
                    <p>No graph-linked pattern concentrated yet.</p>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Global platform failures</p>
                <div className="mt-3 space-y-2 text-sm text-steel">
                  {command.root_cause.root_cause_probabilities.slice(0, 3).map((item) => (
                    <p key={item.cause_type}>
                      {item.label} · {renderProbability(item.probability)}
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Deployment changes</p>
                <div className="mt-3 space-y-2 text-sm text-steel">
                  {command.deployment_context ? (
                    <>
                      <p>{command.deployment_context.model_version?.model_name ?? "Model n/a"}</p>
                      <p>{command.deployment_context.prompt_version?.version ?? "Prompt n/a"}</p>
                      <p>{command.deployment_context.time_since_deployment_minutes} min before incident</p>
                    </>
                  ) : (
                    <p>No deployment was linked to this incident window.</p>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Guardrail triggers</p>
                <div className="mt-3 space-y-2 text-sm text-steel">
                  {command.guardrail_activity.length > 0 ? (
                    command.guardrail_activity.slice(0, 3).map((item) => (
                      <p key={item.policy_type}>
                        {item.policy_type} · {item.trigger_count} triggers
                      </p>
                    ))
                  ) : (
                    <p>No adjacent runtime guardrail signal.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-steel" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Recommended mitigation</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">What the operator should do next</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              <p className="font-medium text-ink">{command.root_cause.recommended_fix.summary}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-steel">Recommended guardrails</p>
              <div className="mt-3 space-y-2 text-sm text-steel">
                {command.recommended_mitigations.length > 0 ? (
                  command.recommended_mitigations.slice(0, 4).map((item) => <p key={item}>{item}</p>)
                ) : (
                  <p>No guardrail recommendation attached yet.</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-4 text-sm text-steel">
              <p className="text-xs uppercase tracking-[0.18em] text-steel">Rollback suggestion</p>
              <p className="mt-3">
                {command.deployment_context
                  ? "A linked deployment was active near incident start. Verify the rollout and consider rollback if the trace compare confirms regression."
                  : "No deployment-linked rollback suggestion is available for this incident."}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-4 text-sm text-steel">
              <p className="text-xs uppercase tracking-[0.18em] text-steel">Model change risk</p>
              <p className="mt-3">
                {command.deployment_context?.model_version
                  ? `${command.deployment_context.model_version.model_name} is part of the deployment context and should be treated as a candidate change vector.`
                  : "No model rollout was linked directly to this incident."}
              </p>
            </div>
            {suggestedFix ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                <p className="font-medium text-ink">{suggestedFix.title}</p>
                <p className="mt-2 leading-6">{suggestedFix.description}</p>
              </div>
            ) : null}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-steel">Incident status</p>
          <div className="mt-4 space-y-2 text-sm text-steel">
            <p><span className="font-medium text-ink">Scope</span> · {String(incident.summary_json.scope_type ?? "n/a")}:{String(incident.summary_json.scope_id ?? "n/a")}</p>
            <p><span className="font-medium text-ink">Window</span> · {String(incident.summary_json.window_minutes ?? "n/a")} min</p>
            <p><span className="font-medium text-ink">Owner</span> · {incident.owner_operator_email ?? "unassigned"}</p>
            <p><span className="font-medium text-ink">Ack</span> · {formatTime(incident.acknowledged_at, screenshotMode)}</p>
          </div>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-steel">Deployment context</p>
          {command.deployment_context ? (
            <div className="mt-4 space-y-2 text-sm text-steel">
              <p><span className="font-medium text-ink">Environment</span> · {command.deployment_context.deployment.environment}</p>
              <p><span className="font-medium text-ink">Deployed</span> · {formatTime(command.deployment_context.deployment.deployed_at, screenshotMode)}</p>
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
                  <p className="mt-1">Last trigger · {formatTime(item.last_trigger_time, screenshotMode)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-steel">No runtime guardrail triggers were recorded for this project.</p>
          )}
        </Card>
      </section>

      {!screenshotMode ? (
        <>
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
                        {command.trace_compare.failing_trace_summary.prompt_version ?? "prompt n/a"}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-steel">No trace available.</p>
                  )}
                </div>
              </div>
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
                          <td className="px-4 py-3 text-sm font-medium text-ink">{item.metric_name}</td>
                          <td className="px-4 py-3 text-sm text-steel">{item.current_value}</td>
                          <td className="px-4 py-3 text-sm text-steel">{item.baseline_value}</td>
                          <td className="px-4 py-3 text-sm text-steel">{formatTime(item.detected_at)}</td>
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
                        </div>
                        {item.severity ? (
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${severityTone(item.severity)}`}>
                            {item.severity}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3">{renderSignalLink(item.metadata, screenshotMode)}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-5 text-sm text-steel">
                    No adjacent deployment, guardrail, or regression signals were found around this incident.
                  </div>
                )}
              </div>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
