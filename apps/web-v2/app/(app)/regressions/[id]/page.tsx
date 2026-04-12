import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3, FolderKanban, GitCompareArrows, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { getRegressionDetail, getProject } from "@/lib/api";

export default async function RegressionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const regression = await getRegressionDetail(id).catch(() => null);

  if (!regression) {
    notFound();
  }

  const project = await getProject(regression.project_id).catch(() => null);
  const metadata = regression.metadata_json ?? {};

  return (
    <div className="min-h-full">
      <PageHeader
        title={regression.metric_name}
        description="Compare the current window against baseline, inspect the affected scope, and jump directly to the related incident when one exists."
        right={
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
            {regression.scope_type}:{regression.scope_id}
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <section className="grid gap-4 xl:grid-cols-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-5">
            <FolderKanban className="h-5 w-5 text-zinc-500" />
            <p className="mt-3 text-sm text-zinc-500">Project</p>
            <p className="mt-2 text-xl font-semibold text-zinc-100">{project?.name ?? regression.project_id}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-5">
            <GitCompareArrows className="h-5 w-5 text-zinc-500" />
            <p className="mt-3 text-sm text-zinc-500">Current vs baseline</p>
            <p className="mt-2 text-xl font-semibold text-zinc-100">
              {regression.current_value} / {regression.baseline_value}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-5">
            <Clock3 className="h-5 w-5 text-zinc-500" />
            <p className="mt-3 text-sm text-zinc-500">Detected</p>
            <p className="mt-2 text-xl font-semibold text-zinc-100">
              {new Date(regression.detected_at).toLocaleString()}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-[24px] p-5">
            <ShieldAlert className="h-5 w-5 text-zinc-500" />
            <p className="mt-3 text-sm text-zinc-500">Related incident</p>
            {regression.related_incident ? (
              <Link
                href={`/incidents/${regression.related_incident.id}`}
                className="mt-2 block text-xl font-semibold text-zinc-100 underline-offset-4 hover:underline"
              >
                {regression.related_incident.severity} {regression.related_incident.status}
              </Link>
            ) : (
              <p className="mt-2 text-xl font-semibold text-zinc-100">No linked incident</p>
            )}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Window compare</p>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 px-4 py-4">
                <p className="text-sm font-medium text-zinc-100">Current window</p>
                <p className="mt-2 text-sm text-zinc-400">{String(metadata.current_window_start ?? "n/a")}</p>
                <p className="mt-1 text-sm text-zinc-400">{String(metadata.current_window_end ?? "n/a")}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 px-4 py-4">
                <p className="text-sm font-medium text-zinc-100">Baseline window</p>
                <p className="mt-2 text-sm text-zinc-400">{String(metadata.baseline_window_start ?? "n/a")}</p>
                <p className="mt-1 text-sm text-zinc-400">{String(metadata.baseline_window_end ?? "n/a")}</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Delta</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-zinc-800 px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">Absolute</p>
                <p className="mt-2 text-sm text-zinc-400">{regression.delta_absolute}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 px-4 py-3">
                <p className="text-sm font-medium text-zinc-100">Percent</p>
                <p className="mt-2 text-sm text-zinc-400">{regression.delta_percent ?? "n/a"}</p>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Likely contributing dimensions</p>
              <Link
                href={`/regressions/${regression.id}/compare`}
                className="text-sm font-medium text-zinc-100 underline-offset-4 hover:underline"
              >
                Open regression compare
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {regression.root_cause_hints.length > 0 ? (
                regression.root_cause_hints.map((hint, index) => (
                  <div key={`${hint.hint_type}-${index}`} className="rounded-2xl border border-zinc-800 px-4 py-3">
                    <p className="text-sm font-medium text-zinc-100">{hint.hint_type.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {hint.dimension}
                      {hint.current_value ? ` · current ${hint.current_value}` : ""}
                      {hint.baseline_value ? ` · baseline ${hint.baseline_value}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-400">No concentrated dimension met the deterministic hint rules.</p>
              )}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Compare path</p>
            <div className="mt-4 space-y-3 text-sm text-zinc-400">
              <p>Project regressions list stays scoped to this project and window history.</p>
              {regression.related_incident ? (
                <Link
                  href={`/incidents/${regression.related_incident.id}`}
                  className="block rounded-2xl border border-zinc-800 px-4 py-3 font-medium text-zinc-100 underline-offset-4 hover:underline"
                >
                  Open related incident
                </Link>
              ) : null}
              <Link
                href={`/regressions/${regression.id}/compare`}
                className="block rounded-2xl border border-zinc-800 px-4 py-3 font-medium text-zinc-100 underline-offset-4 hover:underline"
              >
                Open regression compare
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Prompt version context</p>
            <div className="mt-4 space-y-3">
              {regression.prompt_version_contexts.map((context) => (
                <div key={context.id} className="rounded-2xl border border-zinc-800 px-4 py-3">
                  <p className="text-sm font-medium text-zinc-100">{context.version}</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    current {context.current_count ?? 0} · baseline {context.baseline_count ?? 0}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Model version context</p>
            <div className="mt-4 space-y-3">
              {regression.model_version_contexts.map((context) => (
                <div key={context.id} className="rounded-2xl border border-zinc-800 px-4 py-3">
                  <p className="text-sm font-medium text-zinc-100">
                    {context.provider ?? "provider n/a"} / {context.model_name}
                    {context.model_version ? ` / ${context.model_version}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    current {context.current_count ?? 0} · baseline {context.baseline_count ?? 0}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Current representative traces</p>
            <div className="mt-4 space-y-3">
              {regression.current_representative_traces.map((trace) => (
                <Link
                  key={trace.id}
                  href={`/traces/${trace.id}`}
                  className="block rounded-2xl border border-zinc-800 px-4 py-3 transition hover:bg-zinc-800"
                >
                  <p className="text-sm font-medium text-zinc-100">{trace.request_id}</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {trace.model_name} · {trace.prompt_version ?? "prompt n/a"} · {trace.success ? "success" : trace.error_type ?? "failure"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {trace.latency_ms !== null ? `${trace.latency_ms} ms` : "latency n/a"} · {trace.total_cost_usd ?? "cost n/a"}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-[28px] p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Baseline representative traces</p>
            <div className="mt-4 space-y-3">
              {regression.baseline_representative_traces.map((trace) => (
                <Link
                  key={trace.id}
                  href={`/traces/${trace.id}`}
                  className="block rounded-2xl border border-zinc-800 px-4 py-3 transition hover:bg-zinc-800"
                >
                  <p className="text-sm font-medium text-zinc-100">{trace.request_id}</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {trace.model_name} · {trace.prompt_version ?? "prompt n/a"} · {trace.success ? "success" : trace.error_type ?? "failure"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {trace.latency_ms !== null ? `${trace.latency_ms} ms` : "latency n/a"} · {trace.total_cost_usd ?? "cost n/a"}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}