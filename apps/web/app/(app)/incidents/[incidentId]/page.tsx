import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  CheckCheck,
  Clock3,
  FolderKanban,
  GitCompareArrows,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import type { IncidentEventRead } from "@reliai/types";

import { Button } from "@/components/ui/button";
import { ActionCallout } from "@/components/ui/action-callout";
import { RecommendationCallout } from "@/components/ui/recommendation-callout";
import { Card } from "@/components/ui/card";
import { MetadataBar, MetadataItem } from "@/components/ui/metadata-bar";
import {
  acknowledgeIncident,
  assignIncidentOwner,
  getIncidentAlerts,
  getIncidentCommandCenter,
  getIncidentDetail,
  listProjectCustomMetrics,
  reopenIncident,
  resolveIncident,
} from "@/lib/api";
import { requireOperatorSession } from "@/lib/auth";

function severityTone(severity: string) {
  if (severity === "critical") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (severity === "high") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
}

function deliveryTone(status: string) {
  if (status === "sent") return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "failed") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (status === "suppressed") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
}

function alertStatusLabel(status: string | null | undefined) {
  if (status === "sent") return "Alert sent";
  if (status === "failed") return "Alert failed";
  if (status === "pending") return "Alert pending";
  if (status === "suppressed") return "Alert suppressed";
  return "Alert not sent";
}

function eventLabel(eventType: IncidentEventRead["event_type"]) {
  switch (eventType) {
    case "opened":
      return "Incident opened";
    case "updated":
      return "Incident updated";
    case "acknowledged":
      return "Incident acknowledged";
    case "owner_assigned":
      return "Owner assigned";
    case "owner_cleared":
      return "Owner cleared";
    case "resolved":
      return "Incident resolved";
    case "reopened":
      return "Incident reopened";
    case "alert_attempted":
      return "Alert attempted";
    case "alert_sent":
      return "Alert sent";
    case "alert_failed":
      return "Alert failed";
    case "config_applied":
      return "Config applied";
    case "config_undone":
      return "Config reverted";
  }
}

function eventPrefix(eventType: IncidentEventRead["event_type"]) {
  if (eventType.startsWith("alert")) return "Alert";
  if (eventType.startsWith("config")) return "Config";
  return "Incident";
}

function eventPrefixTone(eventType: IncidentEventRead["event_type"]) {
  if (eventType.startsWith("alert")) return "text-warning";
  if (eventType.startsWith("config")) return "text-secondary";
  return "text-danger";
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

function renderEventSummary(event: IncidentEventRead) {
  const metadata = event.metadata_json ?? {};

  if (event.event_type === "owner_assigned") {
    return emphasizeNumbers(
      String(metadata.owner_operator_email ?? metadata.owner_operator_user_id ?? "Owner updated")
    );
  }
  if (event.event_type === "owner_cleared") {
    return "Incident owner cleared";
  }
  if (event.event_type === "alert_failed") {
    const retry = metadata.will_retry === true ? " · retry scheduled" : "";
    return `${String(metadata.error_message ?? "Slack delivery failed")}${retry}`;
  }
  if (event.event_type === "alert_attempted") {
    return (
      <>
        Slack delivery to {String(metadata.channel_target ?? "slack")} · attempt{" "}
        {emphasizeNumbers(String(metadata.attempt_count ?? 0))}
      </>
    );
  }
  if (event.event_type === "alert_sent") {
    return (
      <>
        Slack sent to {String(metadata.channel_target ?? "slack")} · attempt{" "}
        {emphasizeNumbers(String(metadata.attempt_count ?? 0))}
      </>
    );
  }
  if (event.event_type === "resolved" || event.event_type === "reopened") {
    return String(metadata.reason ?? "Manual lifecycle action");
  }
  if (event.event_type === "updated" || event.event_type === "opened") {
    return (
      <>
        {String(metadata.metric_name ?? "metric")} ·{" "}
        {emphasizeNumbers(String(metadata.current_value ?? "n/a"))} vs{" "}
        {emphasizeNumbers(String(metadata.baseline_value ?? "n/a"))}
      </>
    );
  }
  if (event.event_type === "config_applied" || event.event_type === "config_undone") {
    const impact = metadata.resolution_impact as
      | { summary?: string; status?: string }
      | undefined;
    if (impact?.summary) {
      return impact.summary;
    }
    if (impact?.status === "pending") {
      return "Fix applied. Waiting for post-fix data.";
    }
    return String(metadata.reason ?? "Config change recorded");
  }
  return event.actor_operator_user_email ?? "Operator action";
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined) return "n/a";
  return `${Math.round(value * 100)}%`;
}

export default async function IncidentDetailPage({
  params
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const session = await requireOperatorSession();
  const { incidentId } = await params;
  const [incident, alerts, command] = await Promise.all([
    getIncidentDetail(incidentId).catch(() => null),
    getIncidentAlerts(incidentId).catch(() => ({ items: [] })),
    getIncidentCommandCenter(incidentId).catch(() => null)
  ]);

  if (!incident) {
    notFound();
  }

  const customMetricsResponse = await listProjectCustomMetrics(incident.project_id).catch(() => ({ items: [] }));
  const hasRefusalMetric = customMetricsResponse.items.some((metric) =>
    /(refusal)/i.test(metric.name) || /(refusal)/i.test(metric.metric_key)
  );
  const showRefusalMetricCta =
    incident.incident_type === "refusal_rate_spike" && !hasRefusalMetric;
  const latestAlert = incident.latest_alert_delivery ?? null;

  const rootCauseProbability =
    command?.root_cause.top_root_cause_probability ??
    command?.root_cause.root_cause_probabilities[0]?.probability ??
    null;
  const recommendationKind =
    command?.root_cause.recommendation_kind ??
    (typeof rootCauseProbability === "number" && rootCauseProbability >= 0.8 ? "action" : "recommendation");
  const actionSupporting =
    command?.root_cause.recommended_action_reason ??
    (rootCauseProbability !== null
      ? `Root cause confidence ${percent(rootCauseProbability)} based on trace deltas.`
      : "Root cause signal is based on current trace deltas.");

  async function acknowledgeAction() {
    "use server";
    await acknowledgeIncident(incidentId);
    revalidatePath("/dashboard");
    revalidatePath("/incidents");
    revalidatePath(`/incidents/${incidentId}`);
  }

  async function assignToMeAction() {
    "use server";
    await assignIncidentOwner(incidentId, session.operator.id);
    revalidatePath("/dashboard");
    revalidatePath("/incidents");
    revalidatePath(`/incidents/${incidentId}`);
  }

  async function clearOwnerAction() {
    "use server";
    await assignIncidentOwner(incidentId, null);
    revalidatePath("/dashboard");
    revalidatePath("/incidents");
    revalidatePath(`/incidents/${incidentId}`);
  }

  async function resolveAction() {
    "use server";
    await resolveIncident(incidentId);
    revalidatePath("/dashboard");
    revalidatePath("/incidents");
    revalidatePath(`/incidents/${incidentId}`);
  }

  async function reopenAction() {
    "use server";
    await reopenIncident(incidentId);
    revalidatePath("/dashboard");
    revalidatePath("/incidents");
    revalidatePath(`/incidents/${incidentId}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/incidents" className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Back to incidents
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-ink">{incident.title}</h1>
          <p className="mt-2 text-sm text-steel">
            {incident.project_name} · opened {new Date(incident.started_at).toLocaleString()}
          </p>
          <MetadataBar className="mt-4">
            <MetadataItem label="Project" value={incident.project_name ?? incident.project_id} mono truncate />
            <MetadataItem
              label="Severity"
              value={incident.severity}
              status={incident.severity === "critical" ? "critical" : "neutral"}
            />
            <MetadataItem
              label="Status"
              value={incident.status}
              status={incident.status === "open" ? "critical" : "success"}
            />
            <MetadataItem label="Incident" value={incident.id} mono truncate />
          </MetadataBar>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${deliveryTone(
              latestAlert?.delivery_status ?? "unknown"
            )}`}
            title={
              latestAlert?.delivery_status === "failed" && latestAlert.error_message
                ? latestAlert.error_message
                : undefined
            }
          >
            <BellRing className="h-3.5 w-3.5" />
            {alertStatusLabel(latestAlert?.delivery_status)}
            {latestAlert && latestAlert.attempt_count > 1 ? ` · ${latestAlert.attempt_count} attempts` : ""}
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link href={`/incidents/${incident.id}/investigate`}>Investigate</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href={`/incidents/${incident.id}/command`}>Open Command Center</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-4">
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <FolderKanban className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Project</p>
          <p className="mt-2 text-xl font-semibold text-ink">{incident.project_name}</p>
          <Link
            href={`/projects/${incident.project_id}/reliability`}
            className="mt-3 inline-flex text-sm font-medium text-ink underline-offset-4 hover:underline"
          >
            Open reliability scorecard
          </Link>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <GitCompareArrows className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Metric</p>
          <p className="mt-2 text-xl font-semibold text-ink">
            {String(incident.summary_json.metric_name ?? "n/a")}
          </p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <Clock3 className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Window</p>
          <p className="mt-2 text-xl font-semibold text-ink">
            {String(incident.summary_json.window_minutes ?? "n/a")} min
          </p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <ScanSearch className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Scope</p>
          <p className="mt-2 text-xl font-semibold text-ink">
            {String(incident.summary_json.scope_type ?? "n/a")}:{String(incident.summary_json.scope_id ?? "n/a")}
          </p>
        </Card>
      </section>

      {command ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_420px]">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Likely root cause</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">What probably broke</h2>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4">
                <p className="text-sm font-medium text-ink">
                  {command.root_cause.root_cause_probabilities[0]?.label ?? "No dominant root-cause signal yet"}
                </p>
                <p className="mt-1 text-sm text-steel">
                  Confidence {percent(rootCauseProbability)}
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
                        {item.label} · {percent(item.probability)}
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
                      <p>No deployment linked to this incident window.</p>
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
                      <p>No recent runtime guardrail signal.</p>
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
              {recommendationKind === "action" ? (
                <ActionCallout
                  label="Action"
                  directive={command.root_cause.recommended_fix.summary}
                  supporting={actionSupporting}
                  confidence="high"
                  source="incident engine"
                />
              ) : (
                <RecommendationCallout
                  label="Recommendation"
                  recommendation={command.root_cause.recommended_fix.summary}
                  supporting={actionSupporting}
                />
              )}
              {showRefusalMetricCta ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-4 text-sm text-amber-900">
                  <p className="text-xs uppercase tracking-[0.24em] text-amber-700">Behavioral signal</p>
                  <p className="mt-2 font-semibold">Track this behavior as a metric</p>
                  <p className="mt-2 text-sm">
                    Create a refusal metric to keep this signal visible in Reliability and future incidents.
                  </p>
                  <div className="mt-3">
                    <Button asChild size="sm">
                      <Link href={`/projects/${incident.project_id}/metrics?template=refusal_language&source=incident&incident_id=${incident.id}`}>
                        Create refusal metric
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : null}
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
                    ? "Investigate the linked deployment first. This incident clustered soon after a release."
                    : "No rollback signal is attached because no deployment was linked to the incident window."}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 px-4 py-4 text-sm text-steel">
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Model change risk</p>
                <p className="mt-3">
                  {command.deployment_context?.model_version
                    ? `${command.deployment_context.model_version.model_name} is part of the current deployment context and should be treated as a candidate change vector.`
                    : "No model-version rollout was tied directly to this incident."}
                </p>
              </div>
            </div>
          </Card>
        </section>
      ) : null}

      <Card className="rounded-[28px] border-zinc-300 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Compare</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Current window versus baseline</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">
              This section summarizes the rule context, regression deltas, and representative traces chosen
              with deterministic selection rules.
            </p>
          </div>
          {incident.compare.rule_context ? (
            <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-steel">
              Threshold · {incident.compare.rule_context.comparator} {incident.compare.rule_context.absolute_threshold}
              {incident.compare.rule_context.percent_threshold
                ? ` and ${incident.compare.rule_context.percent_threshold}`
                : ""}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-steel">
          <span>
            Full compare includes side-by-side representative current and baseline traces with metadata,
            retrieval, and structured-output results.
          </span>
          <Link href={`/incidents/${incident.id}/compare`} className="font-medium text-ink underline-offset-4 hover:underline">
            Open compare
          </Link>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[24px] border border-zinc-200 p-4">
            <p className="text-sm font-medium text-ink">Affected regressions</p>
            <div className="mt-4 space-y-3">
              {incident.compare.regressions.map((regression) => (
                <Link
                  key={regression.id}
                  href={`/regressions/${regression.id}`}
                  className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3 transition hover:bg-zinc-50"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{regression.metric_name}</p>
                    <p className="mt-1 text-sm text-steel">
                      {regression.scope_type}:{regression.scope_id}
                    </p>
                  </div>
                  <div className="text-right text-sm text-steel">
                    <p>{regression.current_value} vs {regression.baseline_value}</p>
                    <p className="mt-1">
                      {regression.delta_absolute}
                      {regression.delta_percent ? ` (${regression.delta_percent})` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-zinc-200 p-4">
              <p className="text-sm font-medium text-ink">Windows</p>
              <div className="mt-4 space-y-3 text-sm text-steel">
                <div>
                  <p className="font-medium text-ink">Current</p>
                  <p>{incident.compare.current_window_start ?? "n/a"}</p>
                  <p>{incident.compare.current_window_end ?? "n/a"}</p>
                </div>
                <div>
                  <p className="font-medium text-ink">Baseline</p>
                  <p>{incident.compare.baseline_window_start ?? "n/a"}</p>
                  <p>{incident.compare.baseline_window_end ?? "n/a"}</p>
                </div>
              </div>
            </div>
            <div className="rounded-[24px] border border-zinc-200 p-4">
              <p className="text-sm font-medium text-ink">Root-cause hints</p>
              <div className="mt-4 space-y-3">
                {incident.compare.root_cause_hints.length > 0 ? (
                  incident.compare.root_cause_hints.map((hint, index) => (
                    <div key={`${hint.hint_type}-${index}`} className="rounded-2xl border border-zinc-200 px-4 py-3">
                      <p className="text-sm font-medium text-ink">{hint.hint_type.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-sm text-steel">
                        {hint.dimension}
                        {hint.current_value ? ` · current ${hint.current_value}` : ""}
                        {hint.baseline_value ? ` · baseline ${hint.baseline_value}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-steel">
                        {hint.current_share ? `current share ${hint.current_share}` : ""}
                        {hint.current_metric_value ? ` · current metric ${hint.current_metric_value}` : ""}
                        {hint.baseline_metric_value ? ` · baseline metric ${hint.baseline_metric_value}` : ""}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-steel">No concentrated dimension met the deterministic hint rules.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="rounded-[28px] border-zinc-300 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">AI investigation insights</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Remediation signals</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">
              Graph-backed causes and mitigation suggestions surfaced directly in the remediation flow.
            </p>
          </div>
          {command ? (
            <Link
              href={`/incidents/${incident.id}/command`}
              className="inline-flex items-center gap-2 text-sm font-medium text-ink underline-offset-4 hover:underline"
            >
              Open command center
            </Link>
          ) : null}
        </div>

        {command && (command.possible_root_causes.length > 0 || command.recommended_mitigations.length > 0) ? (
          <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[24px] border border-zinc-200 p-4">
              <p className="text-sm font-medium text-ink">Possible causes</p>
              <div className="mt-4 space-y-3">
                {command.possible_root_causes.map((item, index) => (
                  <div key={`${String(item.pattern ?? index)}-${index}`} className="rounded-2xl border border-zinc-200 px-4 py-3">
                    <p className="text-sm font-medium text-ink">{String(item.pattern ?? "Unknown pattern")}</p>
                    <p className="mt-1 text-sm text-steel">
                      {String(item.type ?? "pattern").replaceAll("_", " ")}
                      {typeof item.confidence === "number" ? ` · ${Math.round(item.confidence * 100)}% confidence` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] border border-zinc-200 p-4">
              <p className="text-sm font-medium text-ink">Recommended mitigations</p>
              <div className="mt-4 space-y-3">
                {command.recommended_mitigations.map((item) => (
                  <div key={item} className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-steel">
                    <p className="font-medium text-ink">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-5 text-sm leading-6 text-steel">
            No graph-backed mitigation suggestions are currently attached to this incident.
          </p>
        )}
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Current representative traces</p>
            <Link href={`/incidents/${incident.id}/compare`} className="text-sm font-medium text-ink underline-offset-4 hover:underline">
              Full compare
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {incident.compare.current_representative_traces.map((trace) => (
              <Link
                key={trace.id}
                href={`/traces/${trace.id}`}
                className="block rounded-2xl border border-zinc-200 px-4 py-3 transition hover:bg-zinc-50"
              >
                <p className="text-sm font-medium text-ink">{trace.request_id}</p>
                <p className="mt-1 text-sm text-steel">
                  {trace.model_name} · {trace.prompt_version ?? "prompt n/a"} ·{" "}
                  {trace.success ? "success" : trace.error_type ?? "failure"}
                </p>
                <p className="mt-1 text-sm text-steel">
                  {trace.latency_ms !== null ? `${trace.latency_ms} ms` : "latency n/a"} ·{" "}
                  {trace.total_cost_usd ?? "cost n/a"}
                </p>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Baseline representative traces</p>
          <div className="mt-4 space-y-3">
            {incident.compare.baseline_representative_traces.map((trace) => (
              <Link
                key={trace.id}
                href={`/traces/${trace.id}`}
                className="block rounded-2xl border border-zinc-200 px-4 py-3 transition hover:bg-zinc-50"
              >
                <p className="text-sm font-medium text-ink">{trace.request_id}</p>
                <p className="mt-1 text-sm text-steel">
                  {trace.model_name} · {trace.prompt_version ?? "prompt n/a"} ·{" "}
                  {trace.success ? "success" : trace.error_type ?? "failure"}
                </p>
                <p className="mt-1 text-sm text-steel">
                  {trace.latency_ms !== null ? `${trace.latency_ms} ms` : "latency n/a"} ·{" "}
                  {trace.total_cost_usd ?? "cost n/a"}
                </p>
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Dimension summaries</p>
          <div className="mt-4 space-y-3">
            {incident.compare.dimension_summaries.map((summary, index) => (
              <div key={`${summary.summary_type}-${index}`} className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="text-sm font-medium text-ink">{summary.summary_type.replaceAll("_", " ")}</p>
                <p className="mt-1 text-sm text-steel">
                  {summary.dimension}
                  {summary.current_value ? ` · current ${summary.current_value}` : ""}
                  {summary.baseline_value ? ` · baseline ${summary.baseline_value}` : ""}
                </p>
                <p className="mt-1 text-sm text-steel">
                  {summary.current_share ? `current share ${summary.current_share}` : ""}
                  {summary.baseline_share ? ` · baseline share ${summary.baseline_share}` : ""}
                  {summary.delta_value ? ` · delta ${summary.delta_value}` : ""}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Trace pivots</p>
          <div className="mt-4 space-y-3">
            {incident.compare.cohort_pivots.map((pivot) => (
              <a
                key={pivot.pivot_type}
                href={pivot.path}
                className="block rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium text-ink transition hover:bg-zinc-50"
              >
                {pivot.label}
              </a>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Prompt version context</p>
          <div className="mt-4 space-y-3">
            {incident.compare.prompt_version_contexts.map((context) => (
              <div key={context.id} className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="text-sm font-medium text-ink">{context.version}</p>
                <p className="mt-1 text-sm text-steel">
                  current {context.current_count ?? 0} · baseline {context.baseline_count ?? 0}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  <a href={context.traces_path} className="text-ink underline-offset-4 hover:underline">Traces</a>
                  <a href={context.regressions_path} className="text-ink underline-offset-4 hover:underline">Regressions</a>
                  <a href={context.incidents_path} className="text-ink underline-offset-4 hover:underline">Incidents</a>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Model version context</p>
          <div className="mt-4 space-y-3">
            {incident.compare.model_version_contexts.map((context) => (
              <div key={context.id} className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="text-sm font-medium text-ink">
                  {context.provider ?? "provider n/a"} / {context.model_name}
                  {context.model_version ? ` / ${context.model_version}` : ""}
                </p>
                <p className="mt-1 text-sm text-steel">
                  current {context.current_count ?? 0} · baseline {context.baseline_count ?? 0}
                </p>
                <a href={context.traces_path} className="mt-2 inline-block text-sm text-ink underline-offset-4 hover:underline">
                  Traces
                </a>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <div className="space-y-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Regression comparison</p>
            {incident.regressions.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-collapse text-left">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-[0.18em] text-steel">
                    <tr>
                      <th className="px-4 py-3 font-medium">Metric</th>
                      <th className="px-4 py-3 font-medium">Current</th>
                      <th className="px-4 py-3 font-medium">Baseline</th>
                      <th className="px-4 py-3 font-medium">Delta</th>
                      <th className="px-4 py-3 font-medium">Detected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incident.regressions.map((regression) => (
                      <tr key={regression.id} className="border-t border-zinc-200">
                        <td className="px-4 py-3 text-sm font-medium text-ink">
                          <Link
                            href={`/regressions/${regression.id}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {regression.metric_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-steel">{regression.current_value}</td>
                        <td className="px-4 py-3 text-sm text-steel">{regression.baseline_value}</td>
                        <td className="px-4 py-3 text-sm text-steel">
                          {regression.delta_absolute}
                          {regression.delta_percent ? ` (${regression.delta_percent})` : ""}
                        </td>
                        <td className="px-4 py-3 text-sm text-steel">
                          {new Date(regression.detected_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-steel">
                No regression snapshots are attached to this incident.
              </p>
            )}
            <div className="mt-4">
              <Link
                href={`/projects/${incident.project_id}/regressions?metric_name=${encodeURIComponent(
                  String(incident.summary_json.metric_name ?? "")
                )}&scope_id=${encodeURIComponent(String(incident.summary_json.scope_id ?? ""))}`}
                className="text-sm text-ink underline-offset-4 hover:underline"
              >
                Open project regressions for this incident
              </Link>
            </div>
          </Card>

          <Card className="rounded-[28px] border-default p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-secondary">Timeline</p>
                <p className="mt-2 text-sm text-secondary">
                  Every lifecycle and alert event on this incident, newest first.
                </p>
              </div>
              <BellRing className="h-5 w-5 text-secondary" />
            </div>
            {incident.events.length > 0 ? (
              <div className="mt-5 space-y-3">
                {incident.events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-default bg-surface-elevated px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em]">
                      <span className={`font-semibold ${eventPrefixTone(event.event_type)}`}>
                        {eventPrefix(event.event_type)}
                      </span>
                      <span className="text-secondary">
                        {new Date(event.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-primary">{eventLabel(event.event_type)}</p>
                    <p className="mt-1 text-sm text-secondary">{renderEventSummary(event)}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-secondary">
                      Actor · {event.actor_operator_user_email ?? "system"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-secondary">
                No incident events have been recorded yet.
              </p>
            )}
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Linked traces</p>
            {incident.traces.length > 0 ? (
              <div className="mt-4 space-y-3">
                {incident.traces.map((trace) => (
                  <Link
                    key={trace.id}
                    href={`/traces/${trace.id}`}
                    className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3 transition hover:bg-zinc-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{trace.request_id}</p>
                      <p className="mt-1 text-sm text-steel">
                        {new Date(trace.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right text-sm text-steel">
                      <p>{trace.success ? "Success" : trace.error_type ?? "Failure"}</p>
                      <p className="mt-1">
                        {trace.latency_ms !== null ? `${trace.latency_ms} ms` : "latency n/a"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-steel">
                No trace samples were attached to this incident.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Operator actions</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="text-sm font-medium text-ink">Acknowledgment</p>
                <p className="mt-2 text-sm text-steel">
                  {incident.acknowledged_at
                    ? `Acknowledged by ${incident.acknowledged_by_operator_email ?? "operator"} at ${new Date(
                        incident.acknowledged_at
                      ).toLocaleString()}`
                    : "Not acknowledged yet"}
                </p>
                {!incident.acknowledged_at && incident.status === "open" ? (
                  <form action={acknowledgeAction} className="mt-3">
                    <Button size="sm">
                      <CheckCheck className="mr-2 h-4 w-4" />
                      Acknowledge
                    </Button>
                  </form>
                ) : null}
              </div>

              <div className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="text-sm font-medium text-ink">Owner</p>
                <p className="mt-2 text-sm text-steel">{incident.owner_operator_email ?? "Unassigned"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {incident.status === "open" && incident.owner_operator_user_id !== session.operator.id ? (
                    <form action={assignToMeAction}>
                      <Button size="sm" variant="outline">
                        <UserRound className="mr-2 h-4 w-4" />
                        Assign to me
                      </Button>
                    </form>
                  ) : null}
                  {incident.owner_operator_user_id ? (
                    <form action={clearOwnerAction}>
                      <Button size="sm" variant="subtle">
                        Clear owner
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="text-sm font-medium text-ink">Lifecycle</p>
                <p className="mt-2 text-sm text-steel">
                  {incident.status === "open"
                    ? "Resolve this incident when the issue is understood or mitigated."
                    : `Resolved ${incident.resolved_at ? new Date(incident.resolved_at).toLocaleString() : "recently"}`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {incident.status === "open" ? (
                    <form action={resolveAction}>
                      <Button size="sm" variant="outline">
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Resolve
                      </Button>
                    </form>
                  ) : (
                    <form action={reopenAction}>
                      <Button size="sm">
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reopen
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Alert deliveries</p>
            {alerts.items.length > 0 ? (
              <div className="mt-4 space-y-3">
                {alerts.items.map((alert) => (
                  <div key={alert.id} className="rounded-2xl border border-zinc-200 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-ink">{alert.channel_type}</p>
                        <p className="mt-1 text-sm text-steel">{alert.channel_target}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${deliveryTone(alert.delivery_status)}`}>
                        {alert.delivery_status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-steel">
                      Attempts {alert.attempt_count}
                      {alert.sent_at
                        ? ` · sent ${new Date(alert.sent_at).toLocaleString()}`
                        : ` · created ${new Date(alert.created_at).toLocaleString()}`}
                    </p>
                    {alert.next_attempt_at ? (
                      <p className="mt-2 text-sm text-steel">
                        Next retry {new Date(alert.next_attempt_at).toLocaleString()}
                      </p>
                    ) : null}
                    {alert.error_message ? (
                      <p className="mt-2 text-sm text-rose-700">{alert.error_message}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-sm leading-6 text-steel">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <p>
                    No alert deliveries have been recorded for this incident yet. A delivery row will
                    appear when the incident opens or reopens and enters the alert path.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
