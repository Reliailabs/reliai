import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getPromptVersionDetail, getProject } from "@/lib/api";

function metricValue(value: number | null) {
  if (value === null) return "n/a";
  return value >= 1 ? value.toFixed(2) : `${(value * 100).toFixed(0)}%`;
}

export default async function PromptVersionDetailPage({
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

  const detail = await getPromptVersionDetail(projectId, id).catch(() => null);
  if (!detail) {
    notFound();
  }
  const project = await getProject(projectId).catch(() => null);
  const prompt = detail.prompt_version;

  return (
    <div className="min-h-full">
      <PageHeader
        title={prompt.version}
        description="Track prompt-scoped usage, incidents, regressions, and reliability signals from the persisted trace registry."
        right={
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
            {project?.name ?? projectId}
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-5">
            <p className="text-sm text-zinc-500">Total traces</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{detail.usage_summary.trace_count}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-5">
            <p className="text-sm text-zinc-500">Related incidents</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{detail.usage_summary.incident_count}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-5">
            <p className="text-sm text-zinc-500">Recent regressions</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{detail.usage_summary.regression_count}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-5">
            <p className="text-sm text-zinc-500">Recent traces</p>
            <p className="mt-2 text-2xl font-semibold text-zinc-100">{detail.usage_summary.recent_trace_count}</p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
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
                      {trace.model_name} · {trace.success ? "success" : trace.error_type ?? "failure"}
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
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Investigation pivots</p>
            <div className="mt-4 space-y-3">
              <a
                href={detail.traces_path}
                className="block rounded-2xl border border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800"
              >
                Open prompt-scoped traces
              </a>
              <a
                href={detail.regressions_path}
                className="block rounded-2xl border border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800"
              >
                Open prompt-scoped regressions
              </a>
              <a
                href={detail.incidents_path}
                className="block rounded-2xl border border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800"
              >
                Open prompt-scoped incidents
              </a>
            </div>
          </div>
        </div>

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
                  <span className="text-zinc-400">→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Recent reliability metrics</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
      </div>
    </div>
  );
}