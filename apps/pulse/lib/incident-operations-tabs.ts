import type { IncidentOperationsTab } from "@/lib/incident-operations-data";

export const INCIDENT_OPERATIONS_TABS: IncidentOperationsTab[] = [
  "overview",
  "investigation",
  "compare",
  "timeline",
  "proposals",
  "verification",
  "rollback",
];

export function resolveIncidentOperationsTab(value: string | null): IncidentOperationsTab {
  if (!value) return "overview";
  return INCIDENT_OPERATIONS_TABS.includes(value as IncidentOperationsTab)
    ? (value as IncidentOperationsTab)
    : "overview";
}
