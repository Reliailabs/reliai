import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Boxes, ChartColumn, FolderKanban, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { getModelVersionDetail, getProject } from "@/lib/api";

function metricValue(value: number | null) {
  if (value === null) return "n/a";
  return value >= 1 ? value.toFixed(2) : `${(value * 100).toFixed(0)}%`;
}

export default async function ModelVersionDetailPage({
  params,
  searchParams,
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
    <div className="min-h-full">
      <PageHeader
        title={model.model_name}
        description="Track model-route usage with canonical family and revision context so incidents and compare views stay stable as traffic grows."
        right={
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
            {project?.name ?? projectId}
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-5">
            <Boxes className="h-5 w-5 text-zinc-500" />
            <p className="mt-3 text-sm text-zinc-500">Model family</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{model.model_family ?? "n/a"}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-5">
            <ChartColumn className="h-5 w-5 text-zinc-500" />
            <p className="mt-3 text-sm text-zinc-500">Model revision</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{model.model_revision ?? "n/a"}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-5">
            <ShieldAlert className="h-5 w-5 text-zinc-500" />
            <p className="mt-3 text-sm text-zinc-500">Related incidents</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{detail.usage_summary.incident_count}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-5">
            <FolderKanban className="h-5 w-5 text-zinc-500" />
            <p className="mt-3 text-sm text-zinc-500">Total traces</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{detail.usage_summary.trace_count}</p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Model metadata</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4 rounded-2xl border border-zinc-800 px-4 py-3">
                <dt className="text-zinc-400">Provider</dt>
                <dd className="text-right text-zinc-100">{model.provider ?? "n/a"}</dd>
              </div>
              <div className="flex justify-between gap-4 rounded-2xl border border-zinc-800 px-4 py-3">
                <dt className="text-zinc-400">Model version</dt>
                <dd className="text-right text-zinc-100">{model.model_version ?? "n/a"}</dd>
              </div>
              <div className="flex justify-between gap-4 rounded-2xl border border-zinc-800 px-4 py-3">
                <dt className="text-zinc-400">Route key</dt>
                <dd className="text-right text-zinc-100">{model.route_key ?? "n/a"}</dd>
              </div>
              <div className="flex justify-between gap-4 rounded-2xl border border-zinc-800 px-4 py-3">
                <dt className="text-zinc-400">Identity key</dt>
                <dd className="break-all text-right text-zinc-100">{model.identity_key}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Investigation pivots</p>
            <div className="mt-4 space-y-3">
              <a
                href={detail.traces_path}
                className="block rounded-2xl border border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800"
              >
                Open model-scoped traces
              </a>
              <a
                href={detail.regressions_path}
                className="block rounded-2xl border border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800"
              >
                Open project regressions
              </a>
              <a
                href={detail.incidents_path}
                className="block rounded-2xl border border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800"
              >
                Open project incidents
              </a>
            </div>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Recent traces</p>
            <div className="mt-4 space-y-3">
              {detail.recent_traces.map((trace) => (
                <Link
                  key={trace.id}
                  href={`/traces/${trace.id}`}
                  className="flex items-center justify-between rounded-2xl border border-zinc-800 px-4 py-3 transition hover:bg-zinc-800"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{trace.request_id}</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {trace.prompt_version ?? "prompt n/a"} · {trace.success ? "success" : trace.error_type ?? "failure"}
                    </p>
                  </div>
                  <p className="text-sm text-zinc-400">
                    {trace.latency_ms !== null ? `${trace.latency_ms} ms` : "latency n/a"}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Related incidents</p>
            <div className="mt-4 space-y-3">
              {detail.related_incidents.map((incident) => (
                <Link
                  key={incident.id}
                  href={`/incidents/${incident.id}`}
                  className="flex items-center justify-between rounded-2xl border border-zinc-800 px-4 py-3 transition hover:bg-zinc-800"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{incident.title}</p>
                    <p className="mt-1 text-sm text-zinc-400">{incident.incident_type} · {incident.status}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-zinc-400" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Recent regressions</p>
            <div className="mt-4 space-y-3">
              {detail.recent_regressions.map((regression) => (
                <Link
                  key={regression.id}
                  href={`/regressions/${regression.id}`}
                  className="block rounded-2xl border border-zinc-800 px-4 py-3 transition hover:bg-zinc-800"
                >
                  <p className="text-sm font-medium text-zinc-100">{regression.metric_name}</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {regression.scope_type}:{regression.scope_id} · {new Date(regression.detected_at).toLocaleString()}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Recent reliability metrics</p>
            <div className="mt-4 grid gap-3">
              {detail.recent_reliability_metrics.map((metric) => (
                <div
                  key={`${metric.metric_name}-${metric.window_end}`}
                  className="rounded-2xl border border-zinc-800 px-4 py-3"
                >
                  <p className="text-sm font-medium text-zinc-100">{metric.metric_name}</p>
                  <p className="mt-2 text-lg font-semibold text-zinc-100">{metricValue(metric.value_number)}</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {new Date(metric.window_start).toLocaleString()} {"->"} {new Date(metric.window_end).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}