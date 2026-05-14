export type AuditActionKind = "new_run" | "start" | "continue" | "rerun";

export function auditCreateRunPath(auditId: string): string {
  return `/api/v1/audits/${auditId}/runs`;
}

export function auditStartRunPath(auditId: string, runId: string): string {
  return `/api/v1/audits/${auditId}/runs/${runId}/start`;
}

export function auditContinueReviewPath(auditId: string, runId: string): string {
  return `/api/v1/audits/${auditId}/runs/${runId}/continue-review`;
}

export function auditRerunStagePath(auditId: string, runId: string, stageKey: string): string {
  return `/api/v1/audits/${auditId}/runs/${runId}/stages/${stageKey}/rerun`;
}

export function resolveAuditActionPath(input: {
  auditId: string;
  action: AuditActionKind;
  runId?: string | null;
  stageKey?: string | null;
}): string | null {
  const { auditId, action, runId, stageKey } = input;
  if (action === "new_run") {
    return auditCreateRunPath(auditId);
  }
  if (!runId) {
    return null;
  }
  if (action === "start") {
    return auditStartRunPath(auditId, runId);
  }
  if (action === "continue") {
    return auditContinueReviewPath(auditId, runId);
  }
  if (action === "rerun" && stageKey) {
    return auditRerunStagePath(auditId, runId, stageKey);
  }
  return null;
}
