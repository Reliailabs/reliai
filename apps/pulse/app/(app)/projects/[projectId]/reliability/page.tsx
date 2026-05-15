import { requireOperatorSession } from "@/lib/auth";
import { getProjectReliabilityPresenter } from "@/lib/project-reliability-surface";
import Link from "next/link";

type ProjectReliabilityPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectReliabilityPage({ params }: ProjectReliabilityPageProps) {
  const { projectId } = await params;
  await requireOperatorSession();
  const data = await getProjectReliabilityPresenter(projectId);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Project Reliability</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">{data.projectName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Read-only reliability posture from source project contracts.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            Reliability score: {data.reliabilityScore === null ? "n/a" : `${Math.round(data.reliabilityScore * 100)}%`}
          </div>
          <Link href={`/projects/${projectId}/timeline`} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
            Open timeline
          </Link>
        </div>
      </div>

      {data.sourceErrors.length > 0 ? (
        <div className="mb-4 rounded-xl border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Data source unavailable: {data.sourceErrors.join(", ")}.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {data.metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Trend series</p>
          <div className="mt-3 space-y-2">
            {data.trendSeries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trend series available.</p>
            ) : (
              data.trendSeries.map((series) => (
                <div key={series.metricName} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium text-foreground">{series.metricName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Latest: {series.latestValue === null ? "n/a" : series.latestValue} · points: {series.pointCount}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recent incidents</p>
          <div className="mt-3 space-y-2">
            {data.recentIncidents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent incidents.</p>
            ) : (
              data.recentIncidents.map((incident) => (
                <Link
                  key={incident.id}
                  href={`/incidents/${incident.id}`}
                  className="block rounded-lg border border-border p-3 hover:bg-muted/40"
                >
                  <p className="text-sm font-medium text-foreground">{incident.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {incident.id} · {incident.severity} · {incident.status}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
