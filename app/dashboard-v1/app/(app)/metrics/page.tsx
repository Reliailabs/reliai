import { PageHeader } from "@/components/ui/page-header";
import { PanelError } from "@/components/ui/panel-error";
import { getProjects, getProjectRegressions, getProjectReliability, getTraces } from "@/lib/api";

export default async function MetricsPage() {
  let projects = { items: [] as Awaited<ReturnType<typeof getProjects>>["items"] };
  let hasError = false;
  try {
    projects = await getProjects();
  } catch {
    hasError = true;
  }
  const firstProject = projects.items[0];
  const [reliabilityResult, regressionsResult, tracesResult] = await Promise.all([
    firstProject
      ? getProjectReliability(firstProject.id)
          .then((data) => ({ data, error: false }))
          .catch(() => ({ data: null, error: true }))
      : Promise.resolve({ data: null, error: false }),
    firstProject
      ? getProjectRegressions(firstProject.id, { limit: 50 })
          .then((data) => ({ data, error: false }))
          .catch(() => ({ data: { items: [] }, error: true }))
      : Promise.resolve({ data: { items: [] }, error: false }),
    getTraces({ limit: 50 })
      .then((data) => ({ data, error: false }))
      .catch(() => ({ data: { items: [] }, error: true })),
  ]);
  hasError = hasError || reliabilityResult.error || regressionsResult.error || tracesResult.error;
  const reliability = reliabilityResult.data;
  const regressions = regressionsResult.data;
  const traces = tracesResult.data;

  const failedTraces = traces.items.filter((trace) => !trace.success).length;
  const riskyRate = traces.items.length ? Math.round((failedTraces / traces.items.length) * 100) : 0;

  return (
    <div className="min-h-full">
      <PageHeader
        title="Metrics"
        description="AI behavior metrics for reliability exposure, drift, and output safety."
      />
      <div className="p-6">
        {hasError ? (
          <div className="mb-4">
            <PanelError detail="One or more metric sources are currently unavailable." />
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="High-risk outputs" value={`${failedTraces}`} hint={`${riskyRate}% of latest traces`} />
        <MetricCard label="Regression detections" value={`${regressions.items.length}`} hint="Recent drift signals" />
        <MetricCard label="Reliability score" value={reliability ? `${Math.round((reliability.reliability_score ?? 0) * 100)}` : "—"} hint="Project reliability index" />
        <MetricCard label="Model drift status" value={regressions.items.length > 0 ? "degraded" : "stable"} hint="Based on regression events" />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-100 tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-zinc-400">{hint}</p>
    </div>
  );
}
