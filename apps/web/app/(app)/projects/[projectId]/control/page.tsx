import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BellElectric,
  Bot,
  Cable,
  Radar,
  ShieldCheck,
  ShieldX,
  TriangleAlert,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  getProject,
  getProjectGuardrailMetrics,
  getProjectRecommendations,
  getProjectReliabilityControlPanel,
} from "@/lib/api";

function percent(value: number | null) {
  if (value === null) return "n/a";
  return `${(value * 100).toFixed(0)}%`;
}

function decimal(value: number | null) {
  if (value === null) return "n/a";
  return value.toFixed(2);
}

function latency(value: number | null) {
  if (value === null) return "n/a";
  return `${Math.round(value)}ms`;
}

function formatTime(value: string | null) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString();
}

function systemStatus(panel: Awaited<ReturnType<typeof getProjectReliabilityControlPanel>>) {
  const highRisk =
    panel.deployment_risk.risk_level === "high" ||
    panel.simulation.risk_level === "high" ||
    panel.incidents.incident_rate_last_24h >= 3;
  if (highRisk) return { label: "RISKY", tone: "border-rose-300 bg-rose-50 text-rose-800", icon: ShieldX };

  const warning =
    panel.deployment_risk.risk_level === "medium" ||
    panel.simulation.risk_level === "medium" ||
    panel.incidents.incident_rate_last_24h > 0;
  if (warning) return { label: "WARNING", tone: "border-amber-300 bg-amber-50 text-amber-800", icon: TriangleAlert };

  return { label: "SAFE", tone: "border-emerald-300 bg-emerald-50 text-emerald-800", icon: ShieldCheck };
}

function severityTone(severity: string) {
  if (severity === "critical") return "text-rose-700";
  if (severity === "high") return "text-orange-700";
  if (severity === "medium") return "text-amber-700";
  return "text-steel";
}

function riskTone(level: string | null) {
  if (level === "high") return "text-rose-700";
  if (level === "medium") return "text-amber-700";
  if (level === "low") return "text-emerald-700";
  return "text-steel";
}

function recommendationTone(severity: string) {
  if (severity === "critical") return "border-rose-200 bg-rose-50 text-rose-800";
  if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-zinc-200 bg-zinc-50 text-zinc-800";
}

function actionStatusTone(status: string) {
  if (status === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "dry_run") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status.startsWith("skipped_")) return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "error") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-zinc-200 bg-zinc-50 text-zinc-800";
}

function actionLabel(actionType: string) {
  return actionType.replaceAll("_", " ");
}

export default async function ProjectControlPanelPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;
  const rawSearchParams = searchParams ? await searchParams : {};
  const environment =
    typeof rawSearchParams.environment === "string" ? rawSearchParams.environment : undefined;
  const [project, panel, recommendations, guardrailMetrics] = await Promise.all([
    getProject(projectId),
    getProjectReliabilityControlPanel(projectId, environment),
    getProjectRecommendations(projectId),
    getProjectGuardrailMetrics(projectId, environment),
  ]);
  const status = systemStatus(panel);
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[30px] border border-zinc-300 bg-white shadow-sm">
        <div className="relative border-b border-zinc-200 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.08),transparent_50%),linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,1))] px-6 py-6">
          <a
            href={`/projects/${projectId}/timeline${environment ? `?environment=${encodeURIComponent(environment)}` : ""}`}
            className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to timeline
          </a>
          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">AI reliability control panel</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{project.name}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
                Single-screen operational readout for deployment risk, incident pressure, guardrail activity,
                and current model reliability.
              </p>
            </div>
            <div className={`inline-flex items-center gap-3 rounded-full border px-5 py-3 text-sm font-semibold ${status.tone}`}>
              <StatusIcon className="h-4 w-4" />
              System Status: {status.label}
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(0,1fr))]">
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-steel">Decision frame</p>
            <p className="mt-3 text-sm leading-6 text-ink">
              Safe means no active medium-or-higher deployment signal and no elevated incident churn in the last
              24 hours. Warning captures recoverable pressure. Risky means a deployment or simulation is high
              risk, or incidents are stacking up now.
            </p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-steel">Incident rate</p>
            <p className="mt-3 text-3xl font-semibold text-ink">{panel.incidents.incident_rate_last_24h}</p>
            <p className="mt-2 text-sm text-steel">Opened or reopened incident records in the last 24h.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-steel">Guardrail triggers</p>
            <p className="mt-3 text-3xl font-semibold text-ink">{panel.guardrails.trigger_rate_last_24h}</p>
            <p className="mt-2 text-sm text-steel">Runtime guardrail enforcement events in the same window.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="grid gap-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Cable className="h-5 w-5 text-steel" />
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-steel">Deployment risk</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">Latest deployment</h2>
                </div>
              </div>
              {panel.deployment_risk.latest_deployment_id ? (
                <Link
                  href={`/deployments/${panel.deployment_risk.latest_deployment_id}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-slate-700"
                >
                  Open deployment
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Deployed</p>
                <p className="mt-2 text-lg font-semibold text-ink">{formatTime(panel.deployment_risk.deployed_at)}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Risk score</p>
                <p className="mt-2 text-lg font-semibold text-ink">{decimal(panel.deployment_risk.risk_score)}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Risk level</p>
                <p className={`mt-2 text-lg font-semibold ${riskTone(panel.deployment_risk.risk_level)}`}>
                  {panel.deployment_risk.risk_level ?? "n/a"}
                </p>
              </div>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-[28px] border-zinc-300 p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Radar className="h-5 w-5 text-steel" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-steel">Simulation</p>
                    <h2 className="mt-2 text-2xl font-semibold text-ink">Predicted blast radius</h2>
                  </div>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                  <span className="text-sm text-steel">Predicted failure rate</span>
                  <span className="text-sm font-medium text-ink">{percent(panel.simulation.predicted_failure_rate)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                  <span className="text-sm text-steel">Predicted latency</span>
                  <span className="text-sm font-medium text-ink">{latency(panel.simulation.predicted_latency)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                  <span className="text-sm text-steel">Risk level</span>
                  <span className={`text-sm font-medium ${riskTone(panel.simulation.risk_level)}`}>
                    {panel.simulation.risk_level ?? "n/a"}
                  </span>
                </div>
              </div>
              <p className="mt-4 text-sm text-steel">Latest simulation run: {formatTime(panel.simulation.created_at)}</p>
            </Card>

            <Card className="rounded-[28px] border-zinc-300 p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <BellElectric className="h-5 w-5 text-steel" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-steel">Guardrails</p>
                    <h2 className="mt-2 text-2xl font-semibold text-ink">Production protection</h2>
                  </div>
                </div>
                <a
                  href={`/projects/${projectId}/guardrails${environment ? `?environment=${encodeURIComponent(environment)}` : ""}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-slate-700"
                >
                  Open dashboard
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                  <span className="text-sm text-steel">Triggers last 24h</span>
                  <span className="text-sm font-medium text-ink">{panel.guardrails.trigger_rate_last_24h}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                  <span className="text-sm text-steel">Top policy triggered</span>
                  <span className="text-sm font-medium text-ink">{panel.guardrails.top_triggered_policy ?? "n/a"}</span>
                </div>
              </div>
            </Card>
          </div>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-steel" />
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-steel">Processors</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">External processor hooks</h2>
                </div>
              </div>
              <a
                href={`/projects/${projectId}/processors${environment ? `?environment=${encodeURIComponent(environment)}` : ""}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-slate-700"
              >
                Open processors
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-steel">
              Register project-scoped HTTP processors for trace and evaluation events. Reliai signs each
              delivery and records failures after bounded retries so external automation stays inspectable.
            </p>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Automatic reliability actions</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Mitigation audit trail</h2>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-steel">
              When automation rules fire, Reliai records whether it rolled back, enabled a guardrail,
              increased sampling, or skipped the action because of dry-run or cooldown safety controls.
            </p>
            {panel.automatic_actions.recent_actions.length === 0 ? (
              <div className="mt-5 rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-sm leading-6 text-steel">
                No automated mitigation actions recorded yet. Recent rollbacks, guardrail enables, sampling
                changes, and processor disables will appear here once an automation rule executes.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {panel.automatic_actions.recent_actions.map((action) => (
                  <div key={action.action_id} className="rounded-[22px] border border-zinc-200 px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {actionLabel(action.action_type)}
                          {" -> "}
                          {action.target}
                        </p>
                        <p className="mt-1 text-sm text-steel">{formatTime(action.created_at)}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${actionStatusTone(action.status)}`}>
                        {action.status.replaceAll("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-steel" />
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-steel">Trace ingestion</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">Volume and metadata control</h2>
                </div>
              </div>
              <a
                href={`/projects/${projectId}/ingestion${environment ? `?environment=${encodeURIComponent(environment)}` : ""}`}
                className="inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-slate-700"
              >
                Open ingestion
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-steel">
              Control downstream sample rates, bound metadata cardinality before it pollutes analytics,
              and keep sensitive metadata keys out of persisted telemetry.
            </p>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <TriangleAlert className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Reliability recommendations</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Suggested next actions</h2>
              </div>
            </div>
            {recommendations.length === 0 ? (
              <div className="mt-5 rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-sm leading-6 text-steel">
                No active recommendations. Reliai will surface deterministic rollout, guardrail, and simulation
                guidance here when reliability signals cross recommendation thresholds.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {recommendations.map((recommendation) => (
                  <div
                    key={recommendation.id}
                    className={`rounded-[22px] border px-4 py-4 ${recommendationTone(recommendation.severity)}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{recommendation.title}</p>
                        <p className="mt-2 text-sm leading-6">{recommendation.description}</p>
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                        {recommendation.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <Bot className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Model reliability</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Current route health</h2>
              </div>
            </div>
            <div className="mt-5 rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-steel">Model</p>
              <p className="mt-2 text-lg font-semibold text-ink">{panel.model_reliability.current_model ?? "n/a"}</p>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                <span className="text-sm text-steel">Success rate</span>
                <span className="text-sm font-medium text-ink">{percent(panel.model_reliability.success_rate)}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                <span className="text-sm text-steel">Average latency</span>
                <span className="text-sm font-medium text-ink">{latency(panel.model_reliability.average_latency)}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                <span className="text-sm text-steel">Structured output validity</span>
                <span className="text-sm font-medium text-ink">
                  {percent(panel.model_reliability.structured_output_validity)}
                </span>
              </div>
            </div>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <TriangleAlert className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Active incidents</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Daily investigation queue</h2>
              </div>
            </div>
            {panel.incidents.recent_incidents.length === 0 ? (
              <div className="mt-5 rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-sm leading-6 text-steel">
                No recent incidents recorded for this project. This page will highlight the latest incident queue
                as soon as regressions create or reopen incidents.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {panel.incidents.recent_incidents.map((incident) => (
                  <div
                    key={incident.incident_id}
                    className="rounded-[22px] border border-zinc-200 px-4 py-4 transition hover:bg-zinc-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Link href={`/incidents/${incident.incident_id}`} className="text-sm font-medium text-ink underline-offset-4 hover:underline">
                          {incident.title}
                        </Link>
                        <p className="mt-1 text-sm text-steel">{formatTime(incident.started_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium uppercase ${severityTone(incident.severity)}`}>
                          {incident.severity}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-steel">{incident.status}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-sm font-medium text-ink">
                      <Link href={`/incidents/${incident.incident_id}`} className="underline-offset-4 hover:underline">
                        Open incident
                      </Link>
                      <Link href={`/incidents/${incident.incident_id}/investigate`} className="underline-offset-4 hover:underline">
                        Investigate
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <BellElectric className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Recent guardrail triggers</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Runtime interventions</h2>
              </div>
            </div>
            {guardrailMetrics.recent_events.length === 0 ? (
              <div className="mt-5 rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-sm leading-6 text-steel">
                No recent runtime guardrail triggers were recorded. Retries, blocks, and fallbacks will appear here
                once production traffic starts hitting active policies.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {guardrailMetrics.recent_events.slice(0, 5).map((event) => (
                  <div key={`${event.trace_id}-${event.created_at}`} className="rounded-[22px] border border-zinc-200 px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-ink">{event.policy_type}</p>
                        <p className="mt-1 text-sm text-steel">
                          {event.action_taken} · {event.provider_model ?? "model n/a"} · {formatTime(event.created_at)}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-ink">{event.latency_ms ? `${event.latency_ms}ms` : "n/a"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
