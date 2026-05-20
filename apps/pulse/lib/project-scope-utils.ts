export type ProjectScopeOption = {
  id: string;
  name: string;
  created_at: string;
};

export function resolveScopedProjectId(projects: ProjectScopeOption[], projectIdParam?: string | null): string | null {
  if (projectIdParam) {
    const match = projects.find((project) => project.id === projectIdParam);
    if (match) return match.id;
  }

  const newest = projects
    .slice()
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];

  return newest?.id ?? null;
}
