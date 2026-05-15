export type IncidentAliasMode = "investigate" | "compare";

export function toIncidentOperationsAliasPath(incidentId: string, mode: IncidentAliasMode): string {
  const tab = mode === "investigate" ? "investigation" : "compare";
  return `/operations/incidents/${encodeURIComponent(incidentId)}?tab=${tab}`;
}
