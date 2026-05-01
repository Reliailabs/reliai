import Link from "next/link";
import { ArrowRight, FolderKanban, GitCompareArrows } from "lucide-react";

import { SubPageHeader } from "@/components/ui/sub-page-header";
import { getProject, getProjectRegressionsFiltered } from "@/lib/api";

export default async function ProjectRegressionsPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const metricName = typeof query.metric_name === "string" ? query.metric_name : "";
  const scopeId = typeof query.scope_id === "string" ? query.scope_id : "";
  const [project, regressions] = await Promise.all([
    getProject(id),
    getProjectRegressionsFiltered(id, {
      ...(metricName ? { metricName } : {}),
      ...(scopeId ? { scopeId } : {}),
      limit: 50
    })
  ]);

  return (
    <div className="p-6 space-y-6">
      <SubPageHeader
        label="Project regressions"
        title={project.name}
        description="Persisted regression snapshots for this project. Use this view to inspect the metric and scope that triggered an incident."
        backHref="/incidents"
        backLabel="Back to incidents"
        right={
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${id}/reliability`}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-zinc-900"
            >
              Reliability scorecard
            </Link>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-500">
              {metricName || "all metrics"} · {scopeId || "all scopes"}
            </div>
          </div>
        }
      />

      <div className="overflow-hidden rounded-lg border-zinc-800">
        <div className="border-b border-zinc-800 px-6 py-5">
          <div className="flex items-center gap-3">
            <FolderKanban className="h-5 w-5 text-zinc-500" />
            <p className="text-sm text-zinc-500">{project.environment}</p>
          </div>
        </div>
        {regressions.items.length === 0 ? (
          <div className="px-6 py-10 text-sm leading-6 text-zinc-500">
            No regression snapshots match this filter.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {regressions.items.map((regression) => (
              <Link
                key={regression.id}
                href={`/regressions/${regression.id}`}
                className="grid gap-4 px-6 py-4 transition hover:bg-zinc-900 lg:grid-cols-[minmax(0,1.2fr)_180px_180px_180px_200px_20px] lg:items-center"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-100">{regression.metric_name}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {regression.scope_type}:{regression.scope_id}
                  </p>
                </div>
                <div className="text-sm text-zinc-500">Current {regression.current_value}</div>
                <div className="text-sm text-zinc-500">Baseline {regression.baseline_value}</div>
                <div className="text-sm text-zinc-500">
                  <span className="inline-flex items-center gap-2">
                    <GitCompareArrows className="h-4 w-4" />
                    {regression.delta_absolute}
                    {regression.delta_percent ? ` (${regression.delta_percent})` : ""}
                  </span>
                </div>
                <div className="text-sm text-zinc-500">
                  {new Date(regression.detected_at).toLocaleString()}
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-500" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
