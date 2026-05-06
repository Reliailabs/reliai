import Link from "next/link";
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

function renderSummary(summary: string) {
  const pattern = /(\d+(?:\.\d+)?\s*->\s*\d+(?:\.\d+)?)/g;
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
              return (
                <div key={`${event.event_type}-${event.timestamp}-${index}`} className="relative pb-6 last:pb-0">
                  <div className={`absolute -left-[43px] top-5 flex h-7 w-7 items-center justify-center rounded-full border border-default bg-surface ${eventTone}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <article className="rounded-[24px] border border-default bg-surface-elevated p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em]">
                          <span className={`font-semibold ${eventTone}`}>{eventLabel(event.event_type)}</span>
                          {meta ? <span className="text-secondary">· {meta}</span> : null}
                        </div>
                        <h2 className="text-lg font-semibold text-primary">{event.title}</h2>
                        <p className="text-sm leading-6 text-secondary">{renderSummary(event.summary)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {severityClass ? <span className={severityClass}>{event.severity}</span> : null}
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-secondary">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {href ? (
                      <div className="mt-4">
                        <a
                          href={href}
                          className="inline-flex items-center gap-2 text-sm font-semibold text-accent underline-offset-4 hover:underline"
                        >
                          Open detail
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      </div>
                    ) : null}
                  </article>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
