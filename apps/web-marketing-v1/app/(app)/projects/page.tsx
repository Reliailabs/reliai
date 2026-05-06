import type { Route } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listProjects } from "@/lib/api";
import { requireOperatorSession } from "@/lib/auth";

function withEnvironment(path: string, environment?: string | null) {
  if (!environment) return path;
  return `${path}?environment=${encodeURIComponent(environment)}`;
}

function incidentsLink(projectId: string, environment?: string | null) {
  const params = new URLSearchParams({ projectId });
  if (environment) {
    params.set("environment", environment);
  }
  return `/incidents?${params.toString()}`;
}

export default async function ProjectsPage() {
  const session = await requireOperatorSession();
  const activeOrganizationId =
    session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
  const activeOrganizationName =
    session.memberships.find((membership) => membership.organization_id === activeOrganizationId)
      ?.organization_name ?? "Active organization";
  const projectList = activeOrganizationId
    ? await listProjects({ organizationId: activeOrganizationId, limit: 200 }).catch(() => null)
    : null;
  const projects = projectList?.items ?? [];

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-line bg-surface px-6 py-5">
        <p className="text-xs uppercase tracking-[0.24em] text-secondary">Projects</p>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-primary">Workspace projects</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
              Jump into a project control panel or open a specific reliability surface for the active
              organization.
            </p>
          </div>
          {activeOrganizationId ? (
            <div className="rounded-lg border border-line bg-surfaceAlt px-3 py-2 text-xs text-secondary">
              Active org · {activeOrganizationName}
            </div>
          ) : null}
        </div>
      </header>

      {projects.length === 0 ? (
        <Card className="rounded-2xl border-line bg-surface p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-secondary">No projects yet</p>
          <h2 className="mt-3 text-lg font-semibold text-primary">Create your first project workspace</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
            Start by creating a project, run the guided simulation, or connect your system to send
            traces directly.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/onboarding?path=sdk">Create project</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/onboarding?path=simulation">Run simulation</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={"/docs/getting-started" as Route}>Connect your system</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="rounded-2xl border-line bg-surface p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-4 text-left text-sm text-secondary">
              <thead>
                <tr className="text-xs uppercase tracking-[0.24em] text-secondary">
                  <th className="px-2 py-2 font-medium">Project</th>
                  <th className="px-2 py-2 font-medium">Environment</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => {
                  const environment = project.environment?.trim() || null;
                  const openProjectHref = withEnvironment(
                    `/projects/${project.id}/control`,
                    environment
                  );
                  const tabs = [
                    {
                      label: "Reliability",
                      href: withEnvironment(`/projects/${project.id}/reliability`, environment),
                    },
                    { label: "Control", href: openProjectHref },
                    {
                      label: "Timeline",
                      href: withEnvironment(`/projects/${project.id}/timeline`, environment),
                    },
                    {
                      label: "Deployments",
                      href: withEnvironment(`/projects/${project.id}/deployments`, environment),
                    },
                    {
                      label: "Guardrails",
                      href: withEnvironment(`/projects/${project.id}/guardrails`, environment),
                    },
                    { label: "Metrics", href: withEnvironment(`/projects/${project.id}/metrics`, environment) },
                    {
                      label: "Ingestion",
                      href: withEnvironment(`/projects/${project.id}/ingestion`, environment),
                    },
                    {
                      label: "Processors",
                      href: withEnvironment(`/projects/${project.id}/processors`, environment),
                    },
                    {
                      label: "Project settings",
                      href: withEnvironment(`/projects/${project.id}/settings`, environment),
                    },
                    { label: "Incidents", href: incidentsLink(project.id, environment) },
                  ];

                  return (
                    <tr key={project.id} className="rounded-2xl border border-line bg-white">
                      <td className="px-4 py-4 align-top">
                        <div className="text-xs uppercase tracking-[0.24em] text-secondary">Project</div>
                        <div className="mt-2 text-base font-semibold text-primary">{project.name}</div>
                        <p className="mt-2 text-sm text-secondary">
                          {project.description || "Production scope for reliability operations."}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        {environment ? (
                          <span className="rounded-full border border-line bg-surfaceAlt px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-secondary">
                            {environment}
                          </span>
                        ) : (
                          <span className="text-xs text-secondary">Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div>
                          <Button asChild>
                            <Link href={openProjectHref as Route}>Open project</Link>
                          </Button>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {tabs.map((tab) => (
                            <Link
                              key={`${project.id}-${tab.label}`}
                              href={tab.href as Route}
                              className="rounded-full border border-line bg-surfaceAlt px-3 py-1.5 text-xs font-medium text-secondary transition hover:border-border hover:text-primary"
                            >
                              {tab.label}
                            </Link>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
