export type IncidentAliasMode = "investigate" | "compare";

export function toIncidentOperationsAliasPath(
  incidentId: string,
  mode: IncidentAliasMode,
  projectId?: string | null,
): string {
  const tab = mode === "investigate" ? "investigation" : "compare";
  const scopeQuery = projectId ? `&project_id=${encodeURIComponent(projectId)}` : "";
  return `/operations/incidents/${encodeURIComponent(incidentId)}?tab=${tab}${scopeQuery}`;
}
