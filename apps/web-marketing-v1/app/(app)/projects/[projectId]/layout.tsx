import type { ReactNode } from "react";

import { ProjectEnvironmentShell } from "@/components/project-environment-shell";
import { getProject, listProjectEnvironments } from "@/lib/api";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, environments] = await Promise.all([
    getProject(projectId),
    listProjectEnvironments(projectId),
  ]);

  return (
    <div className="space-y-6">
      <ProjectEnvironmentShell
        projectId={projectId}
        projectName={project.name}
        defaultEnvironment={project.environment}
        environments={environments.items}
      />
      {children}
    </div>
  );
}
