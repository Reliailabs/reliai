import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShellFrame } from "@/components/dashboard/app-shell-frame";
import { ProjectScopeSelector } from "@/components/dashboard/project-scope-selector";
import { getRegressionsSurfaceData } from "@/lib/regressions-data";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

function time(v: string | null): string {
  if (!v) return "unknown";
  const parsed = new Date(v);
  if (Number.isNaN(parsed.getTime())) return "unknown";
  return parsed.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

type RegressionDetailPageProps = {
  params: Promise<{ regressionId: string }>;
  searchParams: Promise<{ project_id?: string }>;
};

export default async function RegressionDetailPage({ params, searchParams }: RegressionDetailPageProps) {
  const { regressionId } = await params;
  const { project_id: projectIdParam } = await searchParams;
  const projects = await listProjectScopeOptions();
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const data = await getRegressionsSurfaceData(selectedProjectId ?? undefined);
  const item = data.items.find((row) => row.id === regressionId) ?? null;
  const scopeQuery = selectedProjectId ? `?project_id=${encodeURIComponent(selectedProjectId)}` : "";
  if (!item) notFound();

  return (
    <AppShellFrame activeSection="regressions" projectScope={{ projects, selectedProjectId }}>
      <div className="mx-auto w-full max-w-[1000px] px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Regression — {item.id}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Legacy regression detail. Operations provides timeline/proposal/verification context.</p>
          </div>
          <div className="flex items-center gap-2">
            <ProjectScopeSelector projects={projects} selectedProjectId={selectedProjectId ?? null} />
            <Link href={`/operations/regressions/${item.id}${scopeQuery}`} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
              Open in Operations
            </Link>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">{item.summary}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.status} • detected {time(item.detectedAt)}</p>
        </div>
        <div className="mt-4">
          <Link href={`/regressions${scopeQuery}`} className="text-sm text-muted-foreground hover:text-foreground">
            Back to regressions
          </Link>
        </div>
      </div>
    </AppShellFrame>
  );
}
