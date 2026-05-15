import type { IncidentSurfaceItem } from "@/components/dashboard/pulse-types";

export function toSurfaceStatus(status: string): IncidentSurfaceItem["status"] {
  if (status === "resolved") return "resolved";
  if (status === "acknowledged") return "mitigating";
  if (status === "open") return "investigating";
  return "monitoring";
}

export function patchIncidentList(
  incidents: IncidentSurfaceItem[],
  incidentId: string,
  patch: Partial<IncidentSurfaceItem>,
): IncidentSurfaceItem[] {
  return incidents.map((item) => (item.id === incidentId ? { ...item, ...patch } : item));
}

export function optimisticAssigneeFromEmail(email: string | null): { assignee: string; assigneeInitials: string } {
  if (!email) {
    return { assignee: "Unassigned", assigneeInitials: "UA" };
  }
  const assigneeInitials =
    email
      .split("@")[0]
      ?.split(/[._-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || email.slice(0, 2).toUpperCase();

  return { assignee: email, assigneeInitials };
}
