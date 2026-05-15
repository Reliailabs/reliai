export type AuditRunStatus = "queued" | "running" | "needs_review" | "completed" | "failed" | string;
export type AuditDetailState = {
  latest_run?: { id: string; status?: string | null } | null;
  stages: Array<{ id: string; stage_key: string; stage_label: string; status: string }>;
} | null;

export function canStartRun(status: AuditRunStatus | null | undefined): boolean {
  return status === "queued";
}

export function canContinueReview(status: AuditRunStatus | null | undefined): boolean {
  return status === "needs_review";
}

export function canRerunStage(status: AuditRunStatus | null | undefined): boolean {
  return Boolean(status) && status !== "queued";
}

export function resolveAuditDetailStateAfterAction(
  current: AuditDetailState,
  refreshed: AuditDetailState,
  actionSucceeded: boolean,
): AuditDetailState {
  if (!actionSucceeded) {
    return current;
  }
  return refreshed;
}
