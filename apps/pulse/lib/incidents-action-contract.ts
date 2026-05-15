export function incidentOwnerPath(incidentId: string): string {
  return `/api/v1/incidents/${incidentId}/owner`;
}

export function incidentAcknowledgePath(incidentId: string): string {
  return `/api/v1/incidents/${incidentId}/acknowledge`;
}

export function incidentResolvePath(incidentId: string): string {
  return `/api/v1/incidents/${incidentId}/resolve`;
}

export function incidentReopenPath(incidentId: string): string {
  return `/api/v1/incidents/${incidentId}/reopen`;
}
