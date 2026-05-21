import Link from "next/link";

import { AppShellFrame } from "@/components/dashboard/app-shell-frame";
import { ProjectScopeSelector } from "@/components/dashboard/project-scope-selector";
import { requireOperatorSession } from "@/lib/auth";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

type PlaygroundPageProps = {
  searchParams: Promise<{ project_id?: string }>;
};

export default async function PlaygroundPage({ searchParams }: PlaygroundPageProps) {
  await requireOperatorSession();
  const projects = await listProjectScopeOptions();
  const { project_id: projectIdParam } = await searchParams;
  const selectedProjectId = resolveScopedProjectId(projects, projectIdParam);
  const scopeQuery = selectedProjectId ? `?project_id=${encodeURIComponent(selectedProjectId)}` : "";

  return (
    <AppShellFrame activeSection="overview">
      <main className="mx-auto w-full max-w-[1200px] px-6 py-8">
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Playground</p>
              <h1 className="mt-3 text-3xl font-semibold text-foreground">Interactive Reliability Playground</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                Use a scoped project context to review incident, trace, and operations continuity while deeper write-path migration remains in flight.
              </p>
            </div>
            <ProjectScopeSelector projects={projects} selectedProjectId={selectedProjectId} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/pulse${scopeQuery}`} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
              Back to Pulse
            </Link>
            <Link href={`/operations${scopeQuery}`} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
              Open Operations
            </Link>
            <Link href={`/traces${scopeQuery}`} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
              Open Traces
            </Link>
          </div>
        </section>
      </main>
    </AppShellFrame>
  );
}
