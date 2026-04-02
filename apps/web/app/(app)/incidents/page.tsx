import Link from "next/link";
import { AlertTriangle, ArrowRight, Filter, FolderKanban, SearchSlash, UserRound } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getMetricDisplayName } from "@/components/presenters/ops-format";
import { listIncidents, listProjects } from "@/lib/api";
import { requireOperatorSession } from "@/lib/auth";

function severityTone(severity: string) {
  if (severity === "critical") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (severity === "high") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  if (severity === "medium") return "bg-sky-100 text-sky-700 ring-1 ring-sky-200";
  return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
}

export default async function IncidentsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireOperatorSession();
  const activeOrganizationId = session.active_organization_id;
  const params = searchParams ? await searchParams : {};
  const status = typeof params.status === "string" ? params.status : "";
  const severity = typeof params.severity === "string" ? params.severity : "";
  const owner = typeof params.owner === "string" ? params.owner : "";
  const projectId = typeof params.projectId === "string" ? params.projectId : "";
  const environment = typeof params.environment === "string" ? params.environment : "";
  const dateFrom = typeof params.dateFrom === "string" ? params.dateFrom : "";
  const dateTo = typeof params.dateTo === "string" ? params.dateTo : "";

  const incidents = await listIncidents({
    ...(projectId ? { projectId } : {}),
    ...(environment ? { environment } : {}),
    ...(status === "open" || status === "resolved" ? { status } : {}),
    ...(severity === "critical" || severity === "high" || severity === "medium" || severity === "low"
      ? { severity }
      : {}),
    ...(owner === "me" ? { ownerOperatorUserId: session.operator.id } : {}),
    ...(owner === "assigned" || owner === "unassigned" ? { ownerState: owner } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    limit: 50
  }).catch(() => ({ items: [] }));
  const projects = await listProjects({
    organizationId: activeOrganizationId ?? undefined,
    limit: 200
  }).catch(() => ({ items: [] }));
  const activeCount = incidents.items.filter((incident) => incident.status === "open").length;

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-zinc-300 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Incidents</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              Deterministic reliability incidents
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
              Filter by status, severity, owner, project, and incident start date to narrow the
              operator queue to the incidents that need action now.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-steel">
            {activeCount} open · {incidents.items.length - activeCount} resolved
          </div>
        </div>
      </header>

      <Card className="rounded-[28px] border-zinc-300 p-5">
        <form action="/incidents" className="grid gap-4 xl:grid-cols-[repeat(6,minmax(0,1fr))_auto_auto]">
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-steel">Status</span>
            <select
              name="status"
              defaultValue={status}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-ink"
            >
              <option value="">Any</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-steel">Severity</span>
            <select
              name="severity"
              defaultValue={severity}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-ink"
            >
              <option value="">Any</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-steel">Owner</span>
            <select
              name="owner"
              defaultValue={owner}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-ink"
            >
              <option value="">Any</option>
              <option value="me">Assigned to me</option>
              <option value="assigned">Any assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-steel">Environment</span>
            <select
              name="environment"
              defaultValue={environment}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-ink"
            >
              <option value="">Any</option>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-steel">Project</span>
            <select
              name="projectId"
              defaultValue={projectId}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-ink"
            >
              <option value="">Any</option>
              {projects.items.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-steel">Date range</span>
            <div className="flex gap-2">
              <input
                name="dateFrom"
                type="date"
                defaultValue={dateFrom}
                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-ink"
              />
              <input
                name="dateTo"
                type="date"
                defaultValue={dateTo}
                className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-ink"
              />
            </div>
          </label>
          <button className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-white">
            <Filter className="mr-2 h-4 w-4" />
            Apply
          </button>
          <Link
            href="/incidents"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm text-ink"
          >
            Clear
          </Link>
        </form>
      </Card>

      <Card className="overflow-hidden rounded-[28px] border-zinc-300">
        {incidents.items.length === 0 ? (
          <div className="px-6 py-12">
            <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10">
              <SearchSlash className="h-6 w-6 text-steel" />
              <h2 className="mt-4 text-xl font-semibold text-ink">No incidents match these filters</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-steel">
                Adjust the queue filters or clear them to inspect the broader incident set.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {incidents.items.map((incident) => (
              <Link
                key={incident.id}
                href={`/incidents/${incident.id}`}
                className="grid gap-4 px-6 py-5 transition hover:bg-zinc-50 lg:grid-cols-[minmax(0,1.4fr)_180px_180px_190px_220px_24px] lg:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${severityTone(incident.severity)}`}>
                      {incident.severity}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        incident.status === "open"
                          ? "bg-ink text-white"
                          : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200"
                      }`}
                    >
                      {incident.status}
                    </span>
                    {incident.incident_type === "refusal_rate_spike" ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-rose-100 text-rose-700 ring-1 ring-rose-200">
                        Refusal spike
                      </span>
                    ) : null}
                    {incident.incident_type.startsWith("custom_metric_spike") ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-700 ring-1 ring-amber-200">
                        {getMetricDisplayName(
                          (incident.summary_json?.metric_name as string) ?? null,
                          incident.summary_json,
                        )} spike
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-medium text-ink">{incident.title}</p>
                  <p className="mt-2 text-sm text-steel">{incident.project_name}</p>
                </div>
                <div className="text-sm text-steel">
                  <p className="inline-flex items-center gap-2 text-ink">
                    <FolderKanban className="h-4 w-4 text-steel" />
                    {incident.project_name}
                  </p>
                </div>
                <div className="text-sm text-steel">
                  <p className="inline-flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {getMetricDisplayName(
                      (incident.summary_json?.metric_name as string) ?? null,
                      incident.summary_json,
                    )}
                  </p>
                </div>
                <div className="text-sm text-steel">
                  <p className="inline-flex items-center gap-2">
                    <UserRound className="h-4 w-4" />
                    {incident.owner_operator_email ?? "Unassigned"}
                  </p>
                </div>
                <div className="text-sm text-steel">
                  Started {new Date(incident.started_at).toLocaleString()}
                </div>
                <ArrowRight className="h-4 w-4 text-steel" />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
