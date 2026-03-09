import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, FolderKanban, GitCompareArrows, ShieldAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getProject, getRegressionDetail } from "@/lib/api";

export default async function RegressionDetailPage({
  params
}: {
  params: Promise<{ regressionId: string }>;
}) {
  const { regressionId } = await params;
  const regression = await getRegressionDetail(regressionId).catch(() => null);

  if (!regression) {
    notFound();
  }

  const project = await getProject(regression.project_id).catch(() => null);
  const metadata = regression.metadata_json ?? {};

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-zinc-300 bg-white px-6 py-6 shadow-sm">
        <Link href={`/projects/${regression.project_id}/regressions`} className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          Back to regressions
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Regression detail</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{regression.metric_name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
              Compare the current window against baseline, inspect the affected scope, and jump directly
              to the related incident when one exists.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-steel">
            {regression.scope_type}:{regression.scope_id}
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-4">
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <FolderKanban className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Project</p>
          <p className="mt-2 text-xl font-semibold text-ink">{project?.name ?? regression.project_id}</p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <GitCompareArrows className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Current vs baseline</p>
          <p className="mt-2 text-xl font-semibold text-ink">
            {regression.current_value} / {regression.baseline_value}
          </p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <Clock3 className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Detected</p>
          <p className="mt-2 text-xl font-semibold text-ink">
            {new Date(regression.detected_at).toLocaleString()}
          </p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <ShieldAlert className="h-5 w-5 text-steel" />
          <p className="mt-3 text-sm text-steel">Related incident</p>
          {regression.related_incident ? (
            <Link href={`/incidents/${regression.related_incident.id}`} className="mt-2 block text-xl font-semibold text-ink underline-offset-4 hover:underline">
              {regression.related_incident.severity} {regression.related_incident.status}
            </Link>
          ) : (
            <p className="mt-2 text-xl font-semibold text-ink">No linked incident</p>
          )}
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Window compare</p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 px-4 py-4">
              <p className="text-sm font-medium text-ink">Current window</p>
              <p className="mt-2 text-sm text-steel">{String(metadata.current_window_start ?? "n/a")}</p>
              <p className="mt-1 text-sm text-steel">{String(metadata.current_window_end ?? "n/a")}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-4">
              <p className="text-sm font-medium text-ink">Baseline window</p>
              <p className="mt-2 text-sm text-steel">{String(metadata.baseline_window_start ?? "n/a")}</p>
              <p className="mt-1 text-sm text-steel">{String(metadata.baseline_window_end ?? "n/a")}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Delta</p>
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <p className="text-sm font-medium text-ink">Absolute</p>
              <p className="mt-2 text-sm text-steel">{regression.delta_absolute}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <p className="text-sm font-medium text-ink">Percent</p>
              <p className="mt-2 text-sm text-steel">{regression.delta_percent ?? "n/a"}</p>
            </div>
          </div>
        </Card>
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Likely contributing dimensions</p>
            {regression.related_incident ? (
              <Link href={`/incidents/${regression.related_incident.id}/compare`} className="text-sm font-medium text-ink underline-offset-4 hover:underline">
                Open trace compare
              </Link>
            ) : null}
          </div>
          <div className="mt-4 space-y-3">
            {regression.root_cause_hints.length > 0 ? (
              regression.root_cause_hints.map((hint, index) => (
                <div key={`${hint.hint_type}-${index}`} className="rounded-2xl border border-zinc-200 px-4 py-3">
                  <p className="text-sm font-medium text-ink">{hint.hint_type.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-sm text-steel">
                    {hint.dimension}
                    {hint.current_value ? ` · current ${hint.current_value}` : ""}
                    {hint.baseline_value ? ` · baseline ${hint.baseline_value}` : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-steel">No concentrated dimension met the deterministic hint rules.</p>
            )}
          </div>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Compare path</p>
          <div className="mt-4 space-y-3 text-sm text-steel">
            <p>Project regressions list stays scoped to this project and window history.</p>
            {regression.related_incident ? (
              <Link href={`/incidents/${regression.related_incident.id}`} className="block rounded-2xl border border-zinc-200 px-4 py-3 font-medium text-ink underline-offset-4 hover:underline">
                Open related incident
              </Link>
            ) : null}
            {regression.related_incident ? (
              <Link href={`/incidents/${regression.related_incident.id}/compare`} className="block rounded-2xl border border-zinc-200 px-4 py-3 font-medium text-ink underline-offset-4 hover:underline">
                Open representative trace compare
              </Link>
            ) : (
              <p className="rounded-2xl border border-zinc-200 px-4 py-3">Trace compare is available when a related incident exists.</p>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Current representative traces</p>
          <div className="mt-4 space-y-3">
            {regression.current_representative_traces.map((trace) => (
              <Link key={trace.id} href={`/traces/${trace.id}`} className="block rounded-2xl border border-zinc-200 px-4 py-3 transition hover:bg-zinc-50">
                <p className="text-sm font-medium text-ink">{trace.request_id}</p>
                <p className="mt-1 text-sm text-steel">
                  {trace.model_name} · {trace.prompt_version ?? "prompt n/a"} · {trace.success ? "success" : trace.error_type ?? "failure"}
                </p>
                <p className="mt-1 text-sm text-steel">
                  {trace.latency_ms !== null ? `${trace.latency_ms} ms` : "latency n/a"} · {trace.total_cost_usd ?? "cost n/a"}
                </p>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Baseline representative traces</p>
          <div className="mt-4 space-y-3">
            {regression.baseline_representative_traces.map((trace) => (
              <Link key={trace.id} href={`/traces/${trace.id}`} className="block rounded-2xl border border-zinc-200 px-4 py-3 transition hover:bg-zinc-50">
                <p className="text-sm font-medium text-ink">{trace.request_id}</p>
                <p className="mt-1 text-sm text-steel">
                  {trace.model_name} · {trace.prompt_version ?? "prompt n/a"} · {trace.success ? "success" : trace.error_type ?? "failure"}
                </p>
                <p className="mt-1 text-sm text-steel">
                  {trace.latency_ms !== null ? `${trace.latency_ms} ms` : "latency n/a"} · {trace.total_cost_usd ?? "cost n/a"}
                </p>
              </Link>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
