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
  "rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur-sm";
const metricValueClass = "metric-value font-mono tracking-[-0.03em]";

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
      tone: "border-rose-800 bg-rose-900 text-rose-300",
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
      tone: "border-amber-800 bg-amber-900 text-amber-300",
      icon: TriangleAlert,
    };
  }

  return {
    label: "YES",
    summary: "This AI system looks safe right now.",
    detail: "No major reliability or policy signals are currently concentrated in this project.",
    tone: "border-emerald-800 bg-emerald-900 text-emerald-300",
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
  screenshotWidth,
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
    ? "rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
    : "rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4";
  const contentGridClass = screenshotMode
    ? "grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]"
    : "grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]";
  const columnGapClass = screenshotMode ? "space-y-4" : "space-y-6";
  const panelCardClassName = cn(panelCardClass, screenshotMode && "p-4");
  const sectionTitleClass = screenshotMode ? "mt-1 text-xl font-semibold text-zinc-100" : "mt-2 text-2xl font-semibold text-zinc-100";
  const sectionBodyTopClass = screenshotMode ? "mt-4" : "mt-5";
  const statusCardClass = screenshotMode ? `rounded-lg border p-4 ${status.tone}` : `rounded-lg border p-5 ${status.tone}`;
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
      label: "Custom Metrics",
      href: `/projects/${projectId}/metrics`,
    },
    {
      label: "View Trace Graphs",
      href: "/traces",
    },
  ];

  const projectControls = [
    {
      label: "Manage custom metrics",
      href: `/projects/${projectId}/metrics`,
    },
    {
      label: "Manage ingestion policy",
      href: `/projects/${projectId}/ingestion`,
    },
    {
      label: "Manage processors",
      href: `/projects/${projectId}/processors`,
      helper: "Send events to external systems and downstream workflows.",
    },
    {
      label: "Edit project",
      href: `/projects/${projectId}/settings`,
    },
  ];

  return (
    <div
      className={cn("space-y-6", screenshotMode && "mx-auto space-y-4 overflow-hidden bg-white p-6")}
      data-control-panel-ready=""
      data-control-panel=""
      style={screenshotMode && screenshotWidth ? { width: screenshotWidth, maxWidth: screenshotWidth } : undefined}
    >
      <header className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-sm">
        <div
          className={cn(
            "border-b border-zinc-800",
            screenshotMode ? "bg-zinc-900" : "bg-zinc-900",
            headerPaddingClass,
          )}
        >
          {!screenshotMode ? (
            <a
              href={`/projects/${projectId}/timeline${environment ? `?environment=${encodeURIComponent(environment)}` : ""}`}
              className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to timeline
            </a>
          ) : (
            <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Reliai system status page</p>
          )}

          <div className={topGridGapClass}>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">AI reliability control panel</p>
              <div className="mt-3 flex items-start justify-between gap-4">
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">{projectName}</h1>
                <ControlPanelHeaderTelemetry tracesPerSecond={traceRate} screenshotMode={screenshotMode} />
              </div>
              <p className={cn("mt-3 max-w-2xl text-sm text-zinc-500", screenshotMode ? "leading-5" : "leading-6")}>
                Default status page for this AI system. It answers what is happening, whether it is safe, and where an operator should click next.
              </p>

              {!screenshotMode ? (
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap gap-3">
                    {quickLinks.map((item) => (
                      <a
                        key={item.label}
                        href={item.href}
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-900"
                      >
                        {item.label}
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    ))}
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Project controls</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {projectControls.map((item) => (
                        <a
                          key={item.label}
                          href={item.href}
                          className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-700"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span>{item.label}</span>
                            <ArrowRight className="h-4 w-4 text-zinc-500" />
                          </div>
                          {item.helper ? (
                            <p className="mt-2 text-xs font-normal text-zinc-500">{item.helper}</p>
                          ) : null}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={statusCardClass}>
              <p className="text-xs uppercase tracking-[0.24em]">Is this system safe right now?</p>
              <div className={cn("flex items-start gap-4", screenshotMode ? "mt-3" : "mt-4")}>
                <div className="rounded-lg bg-zinc-950/70 p-3">
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
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Reliability score</p>
                <p
                  className={cn(
                    `mt-3 text-3xl font-semibold ${metricValueClass}`,
                    scoreTone(panel.reliability_score),
                    highlightedMetrics.includes("reliability_score") &&
                      "rounded-lg px-3 py-2 ring-2 ring-sky-600 ring-offset-2 ring-offset-zinc-950",
                  )}
                  data-tour-id="metric-reliability-score"
                >
                  {panel.reliability_score}
                </p>
              </div>
              <div className={metricCardClass}>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Active incidents</p>
                <p
                  className={cn(
                    `mt-3 text-3xl font-semibold text-zinc-100 ${metricValueClass}`,
                    highlightedMetrics.includes("active_incidents") &&
                      "rounded-lg px-3 py-2 ring-2 ring-amber-300 ring-offset-2 ring-offset-zinc-950",
                  )}
                  data-tour-id="metric-active-incidents"
                >
                  {panel.active_incidents}
                </p>
              </div>
              <div className={metricCardClass}>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Guardrails protecting</p>
                <p className={`mt-3 text-3xl font-semibold text-zinc-100 ${metricValueClass}`}>{panel.guardrails.trigger_rate_last_24h}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs uppercase tracking-wide text-zinc-500">Traffic</h3>
            <div className={metricsGridClass}>
              <div className={metricCardClass}>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Traces analyzed (24h)</p>
                <p className={`mt-3 text-3xl font-semibold text-zinc-100 ${metricValueClass}`}>{compactNumber(panel.traces_last_24h)}</p>
              </div>
              <div className={metricCardClass}>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Throughput</p>
                <p className={`mt-3 text-3xl font-semibold text-zinc-100 ${metricValueClass}`}>{traceRate.toFixed(traceRate < 10 ? 1 : 0)}</p>
                <p className={`mt-1 text-xs text-zinc-500 ${metricValueClass}`}>traces/sec · 1m avg</p>
              </div>
              <div className={metricCardClass}>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Active services</p>
                <p className={`mt-3 text-3xl font-semibold text-zinc-100 ${metricValueClass}`}>{panel.active_services ?? 0}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className={contentGridClass}>
        <div className={columnGapClass}>
          <div className={panelCardClassName}>
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-zinc-500" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">System status</p>
                <h2 className={sectionTitleClass}>What needs attention next</h2>
              </div>
            </div>
            <div className={cn(sectionBodyTopClass, screenshotMode ? "grid gap-3 md:grid-cols-3" : "grid gap-4 md:grid-cols-3")}>
              <div className="rounded-lg border border-zinc-800 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Latest deployment</p>
                <p className="mt-2 text-lg font-semibold text-zinc-100">{formatTime(panel.deployment_risk.deployed_at, screenshotMode)}</p>
                <p className={`mt-2 text-sm font-medium ${riskTone(panel.deployment_risk.risk_level)}`}>
                  Risk score {decimal(panel.deployment_risk.risk_score)}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Incident pressure</p>
                <p className="mt-2 text-lg font-semibold text-zinc-100">{panel.incidents.incident_rate_last_24h} incidents / 24h</p>
                <p className="mt-2 text-sm text-zinc-500">
                  {panel.incidents.recent_incidents[0]
                    ? `Latest: ${panel.incidents.recent_incidents[0].title}`
                    : "No recent incidents."}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Guardrail pressure</p>
                <p className="mt-2 text-lg font-semibold text-zinc-100">{panel.guardrails.trigger_rate_last_24h} triggers / 24h</p>
                <p className="mt-2 text-sm text-zinc-500">
                  Top policy: {panel.guardrails.top_triggered_policy ?? "n/a"}
                </p>
              </div>
            </div>
          </div>

          <div className={cn("grid lg:grid-cols-2", screenshotMode ? "gap-4" : "gap-6")}>
            <div className={panelCardClassName}>
              <div className="flex items-center gap-3">
                <Cable className="h-5 w-5 text-zinc-500" />
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Deployment risk</p>
                  <h2 className={sectionTitleClass}>Safety before the next rollout</h2>
                </div>
              </div>
              <div className={cn(sectionBodyTopClass, "space-y-3")}>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3">
                  <span className="text-sm text-zinc-500">Risk level</span>
                  <span className={`text-sm font-medium ${riskTone(panel.deployment_risk.risk_level)}`}>
                    {panel.deployment_risk.risk_level ?? "n/a"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3">
                  <span className="text-sm text-zinc-500">Risk score</span>
                  <span className="text-sm font-medium text-zinc-100">{decimal(panel.deployment_risk.risk_score)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3">
                  <span className="text-sm text-zinc-500">Simulation risk</span>
                  <span className={`text-sm font-medium ${riskTone(panel.simulation.risk_level)}`}>
                    {panel.simulation.risk_level ?? "n/a"}
                  </span>
                </div>
              </div>
              {!screenshotMode && panel.deployment_risk.latest_deployment_id ? (
                <Link
                  href={`/deployments/${panel.deployment_risk.latest_deployment_id}`}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-zinc-100 underline-offset-4 hover:underline"
                >
                  Open deployment safety gate
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>

            <div className={panelCardClassName}>
              <div className="flex items-center gap-3">
                <BellElectric className="h-5 w-5 text-zinc-500" />
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Guardrail activity</p>
                  <h2 className={sectionTitleClass}>Runtime protection coverage</h2>
                </div>
              </div>
              {panel.guardrail_activity.length > 0 ? (
                <div className={cn(sectionBodyTopClass, "space-y-3")}>
                  {panel.guardrail_activity.slice(0, 4).map((item) => (
                    <div key={item.policy_type} className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3">
                      <span className="text-sm text-zinc-500">{item.policy_type.replaceAll("_", " ")}</span>
                      <span className="text-sm font-medium text-zinc-100">{item.trigger_count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={cn(sectionBodyTopClass, "rounded-lg border border-dashed border-zinc-800 bg-zinc-900 px-5 py-8 text-sm leading-6 text-zinc-500")}>
                  No runtime guardrail interventions were recorded in the current window.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={columnGapClass}>
          <div className={panelCardClassName}>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-zinc-500" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Policy compliance</p>
                <h2 className={sectionTitleClass}>Organization guardrail coverage</h2>
              </div>
            </div>
            {panel.guardrail_compliance.length === 0 ? (
              <div className={cn(sectionBodyTopClass, "rounded-lg border border-dashed border-zinc-800 bg-zinc-900 px-5 py-8 text-sm leading-6 text-zinc-500")}>
                No organization-level guardrail policies are active for this project yet.
              </div>
            ) : (
              <div className={cn(sectionBodyTopClass, "grid gap-3")}>
                {panel.guardrail_compliance.map((item) => (
                  <div key={`${item.policy_type}-${item.enforcement_mode}`} className="rounded-lg border border-zinc-800 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{item.policy_type.replaceAll("_", " ")}</p>
                        <p className="mt-1 text-sm text-zinc-500">Mode: {item.enforcement_mode}</p>
                      </div>
                      <p className={`text-lg font-semibold ${coverageTone(item.coverage_pct)}`}>
                        {item.coverage_pct.toFixed(1)}%
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Violations last 24h</span>
                      <span className="font-medium text-zinc-100">{item.violation_count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={panelCardClassName}>
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-zinc-500" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Recommended next step</p>
                <h2 className={sectionTitleClass}>Operator guidance</h2>
              </div>
            </div>
            <div className={cn(sectionBodyTopClass, "space-y-3")}>
              {panel.recommended_guardrails.length > 0 ? (
                panel.recommended_guardrails.slice(0, 3).map((item) => (
                  <div
                    key={`${item.policy_type}-${item.title}`}
                    className={cn(
                      "rounded-lg border border-zinc-800 px-4 py-4",
                      highlightedMetrics.includes("recommended_guardrail") &&
                        item === panel.recommended_guardrails[0] &&
                        "ring-2 ring-emerald-300 ring-offset-2 ring-offset-zinc-950",
                    )}
                    data-tour-id={item === panel.recommended_guardrails[0] ? "metric-recommended-guardrail" : undefined}
                  >
                    <p className="text-sm font-medium text-zinc-100">{item.title}</p>
                    <p className="mt-2 text-sm text-zinc-500">
                      {item.policy_type} {"->"} {item.recommended_action}
                      {item.model_family ? ` for ${item.model_family}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900 px-5 py-8 text-sm leading-6 text-zinc-500">
                  No additional guardrail changes are being recommended right now.
                </div>
              )}
            </div>
          </div>

          {!screenshotMode ? (
            <>
              <div className={panelCardClass}>
                <div className="flex items-center gap-3">
                  <Bot className="h-5 w-5 text-zinc-500" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Current route health</p>
                    <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Model reliability</h2>
                  </div>
                </div>
                <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Model</p>
                  <p className="mt-2 text-lg font-semibold text-zinc-100">{panel.model_reliability.current_model ?? "n/a"}</p>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3">
                    <span className="text-sm text-zinc-500">Success rate</span>
                    <span className="text-sm font-medium text-zinc-100">{percent(panel.model_reliability.success_rate)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3">
                    <span className="text-sm text-zinc-500">Average latency</span>
                    <span className="text-sm font-medium text-zinc-100">{latency(panel.model_reliability.average_latency)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3">
                    <span className="text-sm text-zinc-500">Structured output validity</span>
                    <span className="text-sm font-medium text-zinc-100">
                      {percent(panel.model_reliability.structured_output_validity)}
                    </span>
                  </div>
                </div>
              </div>

              <div className={panelCardClass}>
                <div className="flex items-center gap-3">
                  <Radar className="h-5 w-5 text-zinc-500" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Automatic reliability actions</p>
                    <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Recent mitigation attempts</h2>
                  </div>
                </div>
                {panel.automatic_actions.recent_actions.length === 0 ? (
                  <div className="mt-5 rounded-lg border border-dashed border-zinc-800 bg-zinc-900 px-5 py-8 text-sm leading-6 text-zinc-500">
                    No automated mitigation actions recorded yet.
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {panel.automatic_actions.recent_actions.map((action) => (
                      <div key={action.action_id} className="rounded-lg border border-zinc-800 px-4 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-zinc-100">
                              {actionLabel(action.action_type)} {"->"} {action.target}
                            </p>
                            <p className="mt-1 text-sm text-zinc-500">{formatTime(action.created_at)}</p>
                          </div>
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${actionStatusTone(action.status)}`}>
                            {action.status.replaceAll("_", " ")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
