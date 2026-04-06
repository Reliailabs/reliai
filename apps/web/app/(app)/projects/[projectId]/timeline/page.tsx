import { Fragment } from "react";
import { ArrowLeft, ArrowRight, BellElectric, GitCommitHorizontal, ShieldAlert, TriangleAlert } from "lucide-react";

import type { TimelineEventRead } from "@reliai/types";

import { Card } from "@/components/ui/card";
import { getProject, getProjectTimeline } from "@/lib/api";

function eventIcon(eventType: string) {
  if (eventType === "incident") return ShieldAlert;
  if (eventType === "deployment") return GitCommitHorizontal;
  if (eventType === "guardrail") return BellElectric;
  if (eventType === "guardrail_runtime_enforced") return BellElectric;
  return TriangleAlert;
}

function eventTypeTone(eventType: string) {
  if (eventType === "incident") return "text-danger";
  if (eventType === "regression") return "text-warning";
  if (eventType === "deployment") return "text-primary";
  if (eventType === "guardrail" || eventType === "guardrail_runtime_enforced") return "text-primary";
  return "text-secondary";
}

function severityBadge(severity?: string | null) {
  if (!severity) return null;
  if (severity === "critical") return "badge badge-danger";
  if (severity === "high") return "badge badge-warning";
  if (severity === "medium") return "badge badge-neutral";
  if (severity === "low") return "badge badge-neutral";
  return "badge badge-neutral";
}

function eventLabel(eventType: string) {
  if (eventType === "incident") return "Incident";
  if (eventType === "deployment") return "Deployment";
  if (eventType === "guardrail") return "Guardrail";
  if (eventType === "guardrail_runtime_enforced") return "Runtime guardrail";
  return "Regression";
}

function eventLink(event: TimelineEventRead) {
  const path = typeof event.metadata?.path === "string" ? event.metadata.path : null;
  return path ?? null;
}

function eventMeta(event: TimelineEventRead) {
  return typeof event.metadata?.incident_type === "string"
    ? event.metadata.incident_type
    : typeof event.metadata?.policy_type === "string"
      ? event.metadata.policy_type
      : typeof event.metadata?.metric_name === "string"
        ? event.metadata.metric_name
        : typeof event.metadata?.action_taken === "string"
          ? event.metadata.action_taken
          : null;
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/%/g, "").trim();
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(6);
  }
  if (typeof value === "string") return value;
  return "n/a";
}

function formatRelativeTime(timestamp: string) {
  const target = new Date(timestamp).getTime();
  if (Number.isNaN(target)) return "time n/a";
  const now = Date.now();
  const diffSeconds = Math.max(0, Math.round((now - target) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function eventAccentColor(event: TimelineEventRead) {
  const metricName = typeof event.metadata?.metric_name === "string" ? event.metadata.metric_name.toLowerCase() : "";
  if (metricName.includes("latency") || metricName.includes("performance")) return "var(--color-info)";
  if (metricName.includes("cost") || metricName.includes("token")) return "var(--color-warning)";
  if (metricName.includes("success") || event.event_type === "incident") return "var(--color-danger)";
  if (event.event_type === "regression") return "var(--color-warning)";
  return "var(--color-border)";
}

function extractDelta(event: TimelineEventRead) {
  const currentValue = parseNumber(event.metadata?.current_value);
  const baselineValue = parseNumber(event.metadata?.baseline_value);
  const deltaPercent = parseNumber(event.metadata?.delta_percent);

  const computedPercent =
    deltaPercent !== null
      ? deltaPercent
      : currentValue !== null && baselineValue !== null && baselineValue !== 0
        ? ((currentValue - baselineValue) / Math.abs(baselineValue)) * 100
        : null;

  if (computedPercent === null || !Number.isFinite(computedPercent)) {
    return null;
  }

  const direction = computedPercent >= 0 ? "↑" : "↓";
  const percentLabel = `${direction} ${Math.abs(computedPercent).toFixed(1)}%`;
  const rawLabel =
    currentValue !== null || baselineValue !== null
      ? `${formatNumber(baselineValue)} → ${formatNumber(currentValue)}`
      : null;

  return { percentLabel, rawLabel };
}

export default async function ProjectTimelinePage({
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
  const [project, timeline] = await Promise.all([
    getProject(projectId),
    getProjectTimeline(projectId, 100, environment),
  ]);

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-default bg-surface px-6 py-6 shadow-sm">
        <a
          href={`/projects/${projectId}/reliability${environment ? `?environment=${encodeURIComponent(environment)}` : ""}`}
          className="inline-flex items-center gap-2 text-sm text-secondary hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to reliability
        </a>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Investigation timeline</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-primary">{project.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">
              Unified project chronology across incidents, deployments, regressions, and triggered guardrails.
            </p>
          </div>
          <div className="rounded-2xl border border-default bg-surface-elevated px-4 py-3 text-sm text-secondary">
            {environment ?? project.environment} · {timeline.items.length} events
          </div>
        </div>
      </header>

      {timeline.items.length === 0 ? (
        <Card className="rounded-[28px] border-default p-6">
          <p className="text-sm leading-6 text-secondary">
            No timeline events yet. Deploy a change, ingest traces, or trigger a regression to populate the investigation feed.
          </p>
        </Card>
      ) : (
        <section className="rounded-[28px] border border-default bg-surface px-6 py-6 shadow-sm">
          <div className="relative ml-3 border-l border-dashed border-default pl-8">
            {timeline.items.map((event, index) => {
              const Icon = eventIcon(event.event_type);
              const href = eventLink(event);
              const meta = eventMeta(event);
              const eventTone = eventTypeTone(event.event_type);
              const severityClass = severityBadge(event.severity);
              const delta = extractDelta(event);
              const relativeTime = formatRelativeTime(event.timestamp);
              const environmentLabel =
                typeof event.metadata?.environment === "string"
                  ? event.metadata.environment
                  : environment ?? project.environment;
              return (
                <div key={`${event.event_type}-${event.timestamp}-${index}`} className="relative pb-6 last:pb-0">
                  <div className={`absolute -left-[43px] top-5 flex h-7 w-7 items-center justify-center rounded-full border border-default bg-surface ${eventTone}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {href ? (
                    <a
                      href={href}
                      className="group block rounded-[24px] border border-default bg-surface-elevated p-5 transition hover:-translate-y-[1px] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
                    >
                      <article
                        className="relative pl-4"
                        style={{ borderLeftWidth: "2px", borderLeftStyle: "solid", borderLeftColor: eventAccentColor(event) }}
                      >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em]">
                          <span className={`font-semibold ${eventTone}`}>{eventLabel(event.event_type)}</span>
                          {meta ? <span className="text-secondary">· {meta}</span> : null}
                        </div>
                        <h2 className="text-lg font-semibold text-primary">{event.title}</h2>
                        {delta ? (
                          <div className="space-y-1">
                            <p className="metric-value text-mono-data">{delta.percentLabel}</p>
                            {delta.rawLabel ? (
                              <p className="text-sm text-secondary text-mono-data">{delta.rawLabel}</p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-sm leading-6 text-secondary">{event.summary}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {severityClass ? <span className={severityClass}>{event.severity}</span> : null}
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-secondary">
                          {environmentLabel} · {relativeTime}
                        </p>
                      </div>
                    </div>
                    {href ? (
                      <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent underline-offset-4 group-hover:underline">
                        Open detail
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    ) : null}
                      </article>
                    </a>
                  ) : (
                    <div className="rounded-[24px] border border-default bg-surface-elevated p-5">
                      <article
                        className="relative pl-4"
                        style={{ borderLeftWidth: "2px", borderLeftStyle: "solid", borderLeftColor: eventAccentColor(event) }}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em]">
                              <span className={`font-semibold ${eventTone}`}>{eventLabel(event.event_type)}</span>
                              {meta ? <span className="text-secondary">· {meta}</span> : null}
                            </div>
                            <h2 className="text-lg font-semibold text-primary">{event.title}</h2>
                            {delta ? (
                              <div className="space-y-1">
                                <p className="metric-value text-mono-data">{delta.percentLabel}</p>
                                {delta.rawLabel ? (
                                  <p className="text-sm text-secondary text-mono-data">{delta.rawLabel}</p>
                                ) : null}
                              </div>
                            ) : (
                              <p className="text-sm leading-6 text-secondary">{event.summary}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {severityClass ? <span className={severityClass}>{event.severity}</span> : null}
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-secondary">
                              {environmentLabel} · {relativeTime}
                            </p>
                          </div>
                        </div>
                      </article>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
