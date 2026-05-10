import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";
import type { ProjectControlParityData } from "@/components/dashboard/pulse-types";

type FetchResult<T> = { data: T | null; error: boolean };

type ProjectRead = { id: string; name: string };

type ProjectAuditSummaryRead = {
  certification_status?: string | null;
  audit_risk_score?: number | null;
  open_critical_findings_count?: number | null;
  open_blocking_findings_count?: number | null;
  certification_at_risk?: boolean;
  certification_risk_reason?: string | null;
  latest_audit_id?: string | null;
  latest_audit_completed_at?: string | null;
};

async function apiRequest<T>(path: string): Promise<T> {
  const token = await getApiAccessToken();
  if (!token) throw new Error("missing session token");
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`api request failed: ${response.status}`);
  return (await response.json()) as T;
}

async function safeFetch<T>(promise: Promise<T>): Promise<FetchResult<T>> {
  try {
    return { data: await promise, error: false };
  } catch {
    return { data: null, error: true };
  }
}

export async function getProjectControlParityData(projectId: string): Promise<ProjectControlParityData> {
  const sourceErrors: string[] = [];

  const [projectResult, auditSummaryResult] = await Promise.all([
    safeFetch(apiRequest<ProjectRead>(`/api/v1/projects/${projectId}`)),
    safeFetch(apiRequest<ProjectAuditSummaryRead>(`/api/v1/projects/${projectId}/audit-summary`)),
  ]);

  if (projectResult.error) sourceErrors.push("project");
  if (auditSummaryResult.error) sourceErrors.push("project-audit-summary");

  const project = projectResult.data;
  const auditSummary = auditSummaryResult.data;

  return {
    projectId,
    projectName: project?.name ?? "Project",
    auditCertificationStatus: auditSummary?.certification_status ?? null,
    auditRiskScore: auditSummary?.audit_risk_score ?? null,
    openCriticalFindings: auditSummary?.open_critical_findings_count ?? null,
    openBlockingFindings: auditSummary?.open_blocking_findings_count ?? null,
    certificationAtRisk: Boolean(auditSummary?.certification_at_risk),
    certificationRiskReason: auditSummary?.certification_risk_reason ?? null,
    latestAuditId: auditSummary?.latest_audit_id ?? null,
    latestAuditCompletedAt: auditSummary?.latest_audit_completed_at ?? null,
    sourceErrors: Array.from(new Set(sourceErrors)),
  };
}
