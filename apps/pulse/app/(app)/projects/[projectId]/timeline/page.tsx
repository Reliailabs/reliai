import Link from "next/link";

import { requireOperatorSession } from "@/lib/auth";
import { getProjectTimelineSurfaceData } from "@/lib/project-timeline-data";

type ProjectTimelinePageProps = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function eventTypeLabel(eventType: string) {
  if (eventType === "incident") return "Incident";
  if (eventType === "deployment") return "Deployment";
  if (eventType === "guardrail" || eventType === "guardrail_runtime_enforced") return "Guardrail";
  if (eventType === "regression") return "Regression";
  return "Event";
}

function eventTypeTone(eventType: string) {
  if (eventType === "incident") return "text-red-300";
  if (eventType === "regression") return "text-amber-300";
  if (eventType === "deployment") return "text-blue-300";
  return "text-slate-300";
}

function eventMeta(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const incidentType = typeof metadata.incident_type === "string" ? metadata.incident_type : null;
  const policyType = typeof metadata.policy_type === "string" ? metadata.policy_type : null;
  const metricName = typeof metadata.metric_name === "string" ? metadata.metric_name : null;
  const actionTaken = typeof metadata.action_taken === "string" ? metadata.action_taken : null;
  return incidentType ?? policyType ?? metricName ?? actionTaken;
}

function eventLink(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const path = typeof metadata.path === "string" ? metadata.path : null;
  return path;
}

function severityClass(severity: string | null): string {
  if (severity === "critical") return "border-red-500/40 bg-red-500/20 text-red-200";
  if (severity === "high") return "border-amber-500/40 bg-amber-500/20 text-amber-100";
  if (severity === "medium") return "border-slate-500/40 bg-slate-500/20 text-slate-100";
  if (severity === "low") return "border-slate-500/40 bg-slate-500/20 text-slate-100";
  return "border-slate-500/20 bg-slate-500/10 text-slate-300";
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return parsed.toLocaleString();
}

export default async function ProjectTimelinePage({ params, searchParams }: ProjectTimelinePageProps) {
  const { projectId } = await params;
  const rawSearchParams = searchParams ? await searchParams : {};
  const environment = typeof rawSearchParams.environment === "string" ? rawSearchParams.environment : undefined;

  await requireOperatorSession();
  const data = await getProjectTimelineSurfaceData(projectId, { environment, limit: 100 });

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Investigation Timeline</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">{data.projectName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Unified chronology across incidents, regressions, deployments, and guardrails.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            {data.environment} · {data.items.length} events
          </div>
          <Link href={`/projects/${projectId}/reliability`} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
            Back to reliability
          </Link>
        </div>
      </div>

      {data.sourceErrors.length > 0 ? (
        <div className="mb-4 rounded-xl border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Data source unavailable: {data.sourceErrors.join(", ")}.
        </div>
      ) : null}

      {data.items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No timeline events for this project yet.
        </div>
      ) : (
        <div className="space-y-3">
          {data.items.map((event, index) => {
            const meta = eventMeta(event.metadata);
            const href = eventLink(event.metadata);
            return (
              <article key={`${event.event_type}-${event.timestamp}-${index}`} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em]">
                      <span className={`font-semibold ${eventTypeTone(event.event_type)}`}>{eventTypeLabel(event.event_type)}</span>
                      {meta ? <span className="text-muted-foreground">· {meta}</span> : null}
                    </div>
                    <h2 className="mt-2 text-base font-semibold text-foreground">{event.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{event.summary}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${severityClass(event.severity)}`}>
                      {event.severity ?? "info"}
                    </span>
                    <p className="mt-2 text-xs text-muted-foreground">{formatTimestamp(event.timestamp)}</p>
                  </div>
                </div>
                {href ? (
                  <div className="mt-3">
                    <Link href={href} className="text-sm text-blue-300 hover:text-blue-200 hover:underline">
                      Open detail
                    </Link>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
