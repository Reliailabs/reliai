import Link from "next/link";

import { AppShellFrame } from "@/components/dashboard/app-shell-frame";
import { listProjectScopeOptions } from "@/lib/project-scope-data";

export default async function ProjectsIndexPage() {
  const projects = await listProjectScopeOptions();

  return (
    <AppShellFrame activeSection="overview">
      <div className="mx-auto w-full max-w-[1100px] px-6 py-6">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-[0.24em] text-secondary">Projects</p>
          <h1 className="mt-2 text-3xl font-semibold text-primary">Project index</h1>
          <p className="mt-2 text-sm text-secondary">
            Select a project to open reliability, incidents, traces, and scoped operations views.
          </p>
        </header>

        {projects.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No projects found for this organization.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
              >
                <p className="text-sm font-semibold text-foreground">{project.name}</p>
                <p className="mt-1 text-xs text-muted-foreground font-mono">{project.id}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShellFrame>
  );
}
