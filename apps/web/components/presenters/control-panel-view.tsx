import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BellElectric,
  Bot,
  Cable,
  Radar,
  ShieldCheck,
  ShieldX,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import type { ProjectReliabilityControlPanel } from "@reliai/types";

import { ControlPanelHeaderTelemetry } from "@/components/presenters/control-panel-header-telemetry";
import { Card } from "@/components/ui/card";
import {
  actionStatusTone,
  coverageTone,
  decimal,
  formatTime,
  latency,
  percent,
  riskTone,
  scoreTone,
} from "@/components/presenters/ops-format";
import { cn } from "@/lib/utils";

const panelCardClass =
  "rounded-[24px] border border-zinc-200/90 bg-white/92 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur-sm";
const metricValueClass = "font-mono tracking-[-0.03em]";

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function tracesPerSecond(panel: ProjectReliabilityControlPanel) {
  if (typeof panel.traces_per_second === "number") {
    return panel.traces_per_second;
  }
  return Math.round((panel.traces_last_24h / 86400) * 10) / 10;
}

function statusSummary(panel: ProjectReliabilityControlPanel) {
  const highRisk =
    panel.reliability_score <= 50 ||
    panel.deployment_risk.risk_level === "high" ||
    panel.simulation.risk_level === "high" ||
    panel.incidents.incident_rate_last_24h >= 3 ||
    panel.guardrail_compliance.some((item) => item.coverage_pct < 85);
  if (highRisk) {
    return {
      label: "NO",
      summary: "This AI system is not safe right now.",
      detail: "Recent incidents, deployment risk, or weak policy coverage require operator attention.",
      tone: "border-rose-300 bg-rose-50 text-rose-900",
      icon: ShieldX,
    };
  }

  const warning =
    panel.reliability_score <= 75 ||
    panel.deployment_risk.risk_level === "medium" ||
    panel.simulation.risk_level === "medium" ||
    panel.incidents.incident_rate_last_24h > 0 ||
    panel.guardrail_compliance.some((item) => item.coverage_pct < 95);
  if (warning) {
    return {
      label: "MAYBE",
      summary: "This AI system needs review before the next change.",
      detail: "The system is stable enough to operate, but current signals show elevated reliability risk.",
      tone: "border-amber-300 bg-amber-50 text-amber-900",
      icon: TriangleAlert,
    };
  }

  return {
    label: "YES",
    summary: "This AI system looks safe right now.",
    detail: "No major reliability or policy signals are currently concentrated in this project.",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-900",
    icon: ShieldCheck,
  };
}

function actionLabel(actionType: string) {
  return actionType.replaceAll("_", " ");
}

interface ControlPanelViewProps {
  projectId: string;
  projectName: string;
  panel: ProjectReliabilityControlPanel;
  environment?: string;
  screenshotMode?: boolean;
  screenshotWidth?: number;
  highlightedMetrics?: Array<"reliability_score" | "active_incidents" | "recommended_guardrail">;
}

export function ControlPanelView({
  projectId,
  projectName,
  panel,
  environment,
  screenshotMode = false,
  screenshotWidth = 1600,
  highlightedMetrics = [],
}: ControlPanelViewProps) {
  const status = statusSummary(panel);
  const StatusIcon = status.icon;
  const traceRate = tracesPerSecond(panel);
  const headerPaddingClass = screenshotMode ? "px-5 py-5" : "px-6 py-6";
  const topGridGapClass = screenshotMode ? "mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]" : "mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]";
  const topMetricsSectionClass = screenshotMode ? "space-y-5 px-5 py-4" : "space-y-8 px-6 py-5";
  const metricsGridClass = screenshotMode ? "grid gap-3 sm:grid-cols-2 md:grid-cols-3" : "grid gap-4 sm:grid-cols-2 md:grid-cols-3";
  const metricCardClass = screenshotMode
    ? "rounded-[22px] border border-zinc-200 bg-zinc-50 px-4 py-3"
    : "rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4";
  const contentGridClass = screenshotMode
    ? "grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]"
    : "grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]";
  const columnGapClass = screenshotMode ? "space-y-4" : "space-y-6";
  const panelCardClassName = cn(panelCardClass, screenshotMode && "p-4");
  const sectionTitleClass = screenshotMode ? "mt-1 text-xl font-semibold text-ink" : "mt-2 text-2xl font-semibold text-ink";
  const sectionBodyTopClass = screenshotMode ? "mt-4" : "mt-5";
  const statusCardClass = screenshotMode ? `rounded-[24px] border p-4 ${status.tone}` : `rounded-[28px] border p-5 ${status.tone}`;
  const statusSummaryClass = screenshotMode ? "mt-2 text-xl font-semibold" : "mt-2 text-2xl font-semibold";
  const statusDetailClass = screenshotMode ? "mt-2 text-sm leading-5 opacity-90" : "mt-2 text-sm leading-6 opacity-90";

  const quickLinks = [
    {
      label: "View Incidents",
      href: "/incidents",
    },
    {
      label: "View Deployments",
      href: `/projects/${projectId}/deployments${environment ? `?environment=${encodeURIComponent(environment)}` : ""}`,
    },
    {
      label: "View Guardrails",
      href: `/projects/${projectId}/guardrails${environment ? `?environment=${encodeURIComponent(environment)}` : ""}`,
    },
    {
      label: "View Trace Graphs",
      href: "/traces",
    },
  ];

  return (
    <div
      className={cn("space-y-6", screenshotMode && "mx-auto space-y-4 overflow-hidden bg-white p-6")}
      data-control-panel-ready=""
      data-control-panel=""
      style={screenshotMode ? { width: screenshotWidth, maxWidth: screenshotWidth } : undefined}
    >
      <header className="overflow-hidden rounded-[32px] border border-zinc-300 bg-white shadow-sm">
        <div className={cn("border-b border-zinc-200 bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(255,255,255,1)_55%,rgba(244,244,245,0.9))]", headerPaddingClass)}>
          {!screenshotMode ? (
            <a
              href={`/projects/${projectId}/timeline${environment ? `?environment=${encodeURIComponent(environment)}` : ""}`}
              className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to timeline
            </a>
          ) : (
            <p className="text-xs uppercase tracking-[0.28em] text-steel">Reliai system status page</p>
          )}

          <div className={topGridGapClass}>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-steel">AI reliability control panel</p>
              <div className="mt-3 flex items-start justify-between gap-4">
                <h1 className="text-3xl font-semibold tracking-tight text-ink">{projectName}</h1>
                <ControlPanelHeaderTelemetry tracesPerSecond={traceRate} screenshotMode={screenshotMode} />
              </div>
              <p className={cn("mt-3 max-w-2xl text-sm text-steel", screenshotMode ? "leading-5" : "leading-6")}>
                Default status page for this AI system. It answers what is happening, whether it is safe, and where an operator should click next.
              </p>

              {!screenshotMode ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  {quickLinks.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-zinc-50"
                    >
                      {item.label}
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            <div className={statusCardClass}>
              <p className="text-xs uppercase tracking-[0.24em]">Is this system safe right now?</p>
              <div className={cn("flex items-start gap-4", screenshotMode ? "mt-3" : "mt-4")}>
                <div className="rounded-2xl bg-white/70 p-3">
                  <StatusIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className={`text-sm font-medium uppercase tracking-[0.18em] ${metricValueClass}`}>Answer: {status.label}</p>
                  <p className={statusSummaryClass}>{status.summary}</p>
                  <p className={statusDetailClass}>{status.detail}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={topMetricsSectionClass}>
          <div>
            <h3 className="mb-3 text-xs uppercase tracking-wide text-zinc-500">System Health</h3>
            <div className={metricsGridClass}>
              <div className={metricCardClass}>
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Reliability score</p>
                <p
                  className={cn(
                    `mt-3 text-3xl font-semibold ${metricValueClass}`,
                    scoreTone(panel.reliability_score),
                    highlightedMetrics.includes("reliability_score") &&
                      "rounded-2xl px-3 py-2 ring-2 ring-sky-300 ring-offset-2 ring-offset-white",
                  )}
                  data-tour-id="metric-reliability-score"
                >
                  {panel.reliability_score}
                </p>
              </div>
              <div className={metricCardClass}>
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Active incidents</p>
                <p
                  className={cn(
                    `mt-3 text-3xl font-semibold text-ink ${metricValueClass}`,
                    highlightedMetrics.includes("active_incidents") &&
                      "rounded-2xl px-3 py-2 ring-2 ring-amber-300 ring-offset-2 ring-offset-white",
                  )}
                  data-tour-id="metric-active-incidents"
                >
                  {panel.active_incidents}
                </p>
              </div>
              <div className={metricCardClass}>
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Guardrails protecting</p>
                <p className={`mt-3 text-3xl font-semibold text-ink ${metricValueClass}`}>{panel.guardrails.trigger_rate_last_24h}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs uppercase tracking-wide text-zinc-500">Traffic</h3>
            <div className={metricsGridClass}>
              <div className={metricCardClass}>
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Traces analyzed (24h)</p>
                <p className={`mt-3 text-3xl font-semibold text-ink ${metricValueClass}`}>{compactNumber(panel.traces_last_24h)}</p>
              </div>
              <div className={metricCardClass}>
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Throughput</p>
                <p className={`mt-3 text-3xl font-semibold text-ink ${metricValueClass}`}>{traceRate.toFixed(traceRate < 10 ? 1 : 0)}</p>
                <p className={`mt-1 text-xs text-steel ${metricValueClass}`}>traces/sec · 1m avg</p>
              </div>
              <div className={metricCardClass}>
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Active services</p>
                <p className={`mt-3 text-3xl font-semibold text-ink ${metricValueClass}`}>{panel.active_services ?? 0}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className={contentGridClass}>
        <div className={columnGapClass}>
          <Card className={panelCardClassName}>
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">System status</p>
                <h2 className={sectionTitleClass}>What needs attention next</h2>
              </div>
            </div>
            <div className={cn(sectionBodyTopClass, screenshotMode ? "grid gap-3 md:grid-cols-3" : "grid gap-4 md:grid-cols-3")}>
              <div className="rounded-2xl border border-zinc-200 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Latest deployment</p>
                <p className="mt-2 text-lg font-semibold text-ink">{formatTime(panel.deployment_risk.deployed_at, screenshotMode)}</p>
                <p className={`mt-2 text-sm font-medium ${riskTone(panel.deployment_risk.risk_level)}`}>
                  Risk score {decimal(panel.deployment_risk.risk_score)}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Incident pressure</p>
                <p className="mt-2 text-lg font-semibold text-ink">{panel.incidents.incident_rate_last_24h} incidents / 24h</p>
                <p className="mt-2 text-sm text-steel">
                  {panel.incidents.recent_incidents[0]
                    ? `Latest: ${panel.incidents.recent_incidents[0].title}`
                    : "No recent incidents."}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Guardrail pressure</p>
                <p className="mt-2 text-lg font-semibold text-ink">{panel.guardrails.trigger_rate_last_24h} triggers / 24h</p>
                <p className="mt-2 text-sm text-steel">
                  Top policy: {panel.guardrails.top_triggered_policy ?? "n/a"}
                </p>
              </div>
            </div>
          </Card>

          <div className={cn("grid lg:grid-cols-2", screenshotMode ? "gap-4" : "gap-6")}>
            <Card className={panelCardClassName}>
              <div className="flex items-center gap-3">
                <Cable className="h-5 w-5 text-steel" />
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-steel">Deployment risk</p>
                  <h2 className={sectionTitleClass}>Safety before the next rollout</h2>
                </div>
              </div>
              <div className={cn(sectionBodyTopClass, "space-y-3")}>
                <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                  <span className="text-sm text-steel">Risk level</span>
                  <span className={`text-sm font-medium ${riskTone(panel.deployment_risk.risk_level)}`}>
                    {panel.deployment_risk.risk_level ?? "n/a"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                  <span className="text-sm text-steel">Risk score</span>
                  <span className="text-sm font-medium text-ink">{decimal(panel.deployment_risk.risk_score)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                  <span className="text-sm text-steel">Simulation risk</span>
                  <span className={`text-sm font-medium ${riskTone(panel.simulation.risk_level)}`}>
                    {panel.simulation.risk_level ?? "n/a"}
                  </span>
                </div>
              </div>
              {!screenshotMode && panel.deployment_risk.latest_deployment_id ? (
                <Link
                  href={`/deployments/${panel.deployment_risk.latest_deployment_id}`}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-ink underline-offset-4 hover:underline"
                >
                  Open deployment safety gate
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </Card>

            <Card className={panelCardClassName}>
              <div className="flex items-center gap-3">
                <BellElectric className="h-5 w-5 text-steel" />
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-steel">Guardrail activity</p>
                  <h2 className={sectionTitleClass}>Runtime protection coverage</h2>
                </div>
              </div>
              {panel.guardrail_activity.length > 0 ? (
                <div className={cn(sectionBodyTopClass, "space-y-3")}>
                  {panel.guardrail_activity.slice(0, 4).map((item) => (
                    <div key={item.policy_type} className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                      <span className="text-sm text-steel">{item.policy_type.replaceAll("_", " ")}</span>
                      <span className="text-sm font-medium text-ink">{item.trigger_count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={cn(sectionBodyTopClass, "rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-sm leading-6 text-steel")}>
                  No runtime guardrail interventions were recorded in the current window.
                </div>
              )}
            </Card>
          </div>
        </div>

        <div className={columnGapClass}>
          <Card className={panelCardClassName}>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Policy compliance</p>
                <h2 className={sectionTitleClass}>Organization guardrail coverage</h2>
              </div>
            </div>
            {panel.guardrail_compliance.length === 0 ? (
              <div className={cn(sectionBodyTopClass, "rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-sm leading-6 text-steel")}>
                No organization-level guardrail policies are active for this project yet.
              </div>
            ) : (
              <div className={cn(sectionBodyTopClass, "grid gap-3")}>
                {panel.guardrail_compliance.map((item) => (
                  <div key={`${item.policy_type}-${item.enforcement_mode}`} className="rounded-[24px] border border-zinc-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-ink">{item.policy_type.replaceAll("_", " ")}</p>
                        <p className="mt-1 text-sm text-steel">Mode: {item.enforcement_mode}</p>
                      </div>
                      <p className={`text-lg font-semibold ${coverageTone(item.coverage_pct)}`}>
                        {item.coverage_pct.toFixed(1)}%
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-steel">Violations last 24h</span>
                      <span className="font-medium text-ink">{item.violation_count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className={panelCardClassName}>
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Recommended next step</p>
                <h2 className={sectionTitleClass}>Operator guidance</h2>
              </div>
            </div>
            <div className={cn(sectionBodyTopClass, "space-y-3")}>
              {panel.recommended_guardrails.length > 0 ? (
                panel.recommended_guardrails.slice(0, 3).map((item) => (
                  <div
                    key={`${item.policy_type}-${item.title}`}
                    className={cn(
                      "rounded-[24px] border border-zinc-200 px-4 py-4",
                      highlightedMetrics.includes("recommended_guardrail") &&
                        item === panel.recommended_guardrails[0] &&
                        "ring-2 ring-emerald-300 ring-offset-2 ring-offset-white",
                    )}
                    data-tour-id={item === panel.recommended_guardrails[0] ? "metric-recommended-guardrail" : undefined}
                  >
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <p className="mt-2 text-sm text-steel">
                      {item.policy_type} {"->"} {item.recommended_action}
                      {item.model_family ? ` for ${item.model_family}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-sm leading-6 text-steel">
                  No additional guardrail changes are being recommended right now.
                </div>
              )}
            </div>
          </Card>

          {!screenshotMode ? (
            <>
              <Card className={panelCardClass}>
                <div className="flex items-center gap-3">
                  <Bot className="h-5 w-5 text-steel" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-steel">Current route health</p>
                    <h2 className="mt-2 text-2xl font-semibold text-ink">Model reliability</h2>
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

              <Card className={panelCardClass}>
                <div className="flex items-center gap-3">
                  <Radar className="h-5 w-5 text-steel" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-steel">Automatic reliability actions</p>
                    <h2 className="mt-2 text-2xl font-semibold text-ink">Recent mitigation attempts</h2>
                  </div>
                </div>
                {panel.automatic_actions.recent_actions.length === 0 ? (
                  <div className="mt-5 rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-sm leading-6 text-steel">
                    No automated mitigation actions recorded yet.
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {panel.automatic_actions.recent_actions.map((action) => (
                      <div key={action.action_id} className="rounded-[22px] border border-zinc-200 px-4 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-ink">
                              {actionLabel(action.action_type)} {"->"} {action.target}
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
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
