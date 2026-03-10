import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Boxes, ChartColumn, FolderKanban, ShieldAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getModelVersionDetail, getProject } from "@/lib/api";

function metricValue(value: number | null) {
  if (value === null) return "n/a";
  return value >= 1 ? value.toFixed(2) : `${(value * 100).toFixed(0)}%`;
}

export default async function ModelVersionDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { id } = await params;
  const { projectId } = await searchParams;

  if (!projectId) {
    notFound();
  }

  const detail = await getModelVersionDetail(projectId, id).catch(() => null);
  if (!detail) {
    notFound();
  }
  const project = await getProject(projectId).catch(() => null);
  const model = detail.model_version;

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-zinc-300 bg-white px-6 py-6 shadow-sm">
        <Link href={`/traces?project_id=${projectId}&model_version_id=${model.id}`} className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          Back to model-scoped traces
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Model version</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{model.model_name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
              Track model-route usage with canonical family and revision context so incidents and compare views stay stable as traffic grows.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-steel">
            {project?.name ?? projectId}
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <Boxes className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Model family</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{model.model_family ?? "n/a"}</p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <ChartColumn className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Model revision</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{model.model_revision ?? "n/a"}</p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <ShieldAlert className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Related incidents</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{detail.usage_summary.incident_count}</p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <FolderKanban className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Total traces</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{detail.usage_summary.trace_count}</p>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Model metadata</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4 rounded-2xl border border-zinc-200 px-4 py-3">
              <dt className="text-steel">Provider</dt>
              <dd className="text-right text-ink">{model.provider ?? "n/a"}</dd>
            </div>
            <div className="flex justify-between gap-4 rounded-2xl border border-zinc-200 px-4 py-3">
              <dt className="text-steel">Model version</dt>
              <dd className="text-right text-ink">{model.model_version ?? "n/a"}</dd>
            </div>
            <div className="flex justify-between gap-4 rounded-2xl border border-zinc-200 px-4 py-3">
              <dt className="text-steel">Route key</dt>
              <dd className="text-right text-ink">{model.route_key ?? "n/a"}</dd>
            </div>
            <div className="flex justify-between gap-4 rounded-2xl border border-zinc-200 px-4 py-3">
              <dt className="text-steel">Identity key</dt>
              <dd className="break-all text-right text-ink">{model.identity_key}</dd>
            </div>
          </dl>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Investigation pivots</p>
          <div className="mt-4 space-y-3">
            <a href={detail.traces_path} className="block rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium text-ink transition hover:bg-zinc-50">
              Open model-scoped traces
            </a>
            <a href={detail.regressions_path} className="block rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium text-ink transition hover:bg-zinc-50">
              Open project regressions
            </a>
            <a href={detail.incidents_path} className="block rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium text-ink transition hover:bg-zinc-50">
              Open project incidents
            </a>
          </div>
        </Card>
      </div>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Recent traces</p>
          <div className="mt-4 space-y-3">
            {detail.recent_traces.map((trace) => (
              <Link
                key={trace.id}
                href={`/traces/${trace.id}`}
                className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3 transition hover:bg-zinc-50"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{trace.request_id}</p>
                  <p className="mt-1 text-sm text-steel">
                    {trace.prompt_version ?? "prompt n/a"} · {trace.success ? "success" : trace.error_type ?? "failure"}
                  </p>
                </div>
                <p className="text-sm text-steel">
                  {trace.latency_ms !== null ? `${trace.latency_ms} ms` : "latency n/a"}
                </p>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Related incidents</p>
          <div className="mt-4 space-y-3">
            {detail.related_incidents.map((incident) => (
              <Link
                key={incident.id}
                href={`/incidents/${incident.id}`}
                className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3 transition hover:bg-zinc-50"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{incident.title}</p>
                  <p className="mt-1 text-sm text-steel">{incident.incident_type} · {incident.status}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-steel" />
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Recent regressions</p>
          <div className="mt-4 space-y-3">
            {detail.recent_regressions.map((regression) => (
              <Link
                key={regression.id}
                href={`/regressions/${regression.id}`}
                className="block rounded-2xl border border-zinc-200 px-4 py-3 transition hover:bg-zinc-50"
              >
                <p className="text-sm font-medium text-ink">{regression.metric_name}</p>
                <p className="mt-1 text-sm text-steel">
                  {regression.scope_type}:{regression.scope_id} · {new Date(regression.detected_at).toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Recent reliability metrics</p>
          <div className="mt-4 grid gap-3">
            {detail.recent_reliability_metrics.map((metric) => (
              <div key={`${metric.metric_name}-${metric.window_end}`} className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="text-sm font-medium text-ink">{metric.metric_name}</p>
                <p className="mt-2 text-lg font-semibold text-ink">{metricValue(metric.value_number)}</p>
                <p className="mt-1 text-sm text-steel">
                  {new Date(metric.window_start).toLocaleString()} {"->"} {new Date(metric.window_end).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
