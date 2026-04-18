import Link from "next/link";

import {
  getProject,
  getProjectAuditMonitoringRecommendations,
  getProjectAuditSummary,
  getProjectReliabilityControlPanel,
} from "@/lib/api";
import { Card } from "@/components/ui/card";
import { ControlPanelView } from "@/components/presenters/control-panel-view";

export default async function ProjectControlPanelPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;
  const rawSearchParams = searchParams ? await searchParams : {};
  const environment =
    typeof rawSearchParams.environment === "string" ? rawSearchParams.environment : undefined;
  const [project, panel, auditSummary, auditRecommendations] = await Promise.all([
    getProject(projectId),
    getProjectReliabilityControlPanel(projectId, environment),
    getProjectAuditSummary(projectId).catch(() => null),
    getProjectAuditMonitoringRecommendations(projectId).catch(() => ({ items: [] })),
  ]);
  const recommendationPreview = auditRecommendations.items.slice(0, 3);

  return (
    <div className="space-y-6">
      {auditSummary ? (
        <Card className="rounded-2xl border-line bg-surface p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-secondary">Audit Status</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm text-secondary">
            <p>
              Certification: <span className="font-semibold text-primary">{auditSummary.certification_status}</span>
            </p>
            <p>
              Risk score: <span className="font-semibold text-primary">{auditSummary.audit_risk_score ?? "—"}</span>
            </p>
            <p>
              Critical / blocking:{" "}
              <span className="font-semibold text-primary">
                {auditSummary.open_critical_findings_count} / {auditSummary.open_blocking_findings_count}
              </span>
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {auditSummary.latest_audit_id ? (
              <Link
                href={`/audits/${auditSummary.latest_audit_id}`}
                className="rounded-full border border-line bg-white px-3 py-1 text-xs text-secondary hover:text-primary"
              >
                Open latest audit
              </Link>
            ) : null}
            {auditSummary.latest_audit_completed_at ? (
              <p className="text-xs text-secondary">
                Last completed audit: {new Date(auditSummary.latest_audit_completed_at).toLocaleString()}
              </p>
            ) : null}
          </div>
          {auditSummary.certification_at_risk ? (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Certification at risk. {auditSummary.certification_risk_reason ?? "New post-certification signals crossed defined thresholds."}
            </div>
          ) : null}
          {recommendationPreview.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-secondary">Suggested monitoring</p>
              <div className="grid gap-2 md:grid-cols-2">
                {recommendationPreview.map((item) => (
                  <div key={item.id} className="rounded-lg border border-line bg-white p-3 text-xs text-secondary">
                    <p className="font-medium text-primary">{item.recommendation_type}</p>
                    <p className="mt-1">Scope: {item.scope || "—"}</p>
                    <p className="mt-1">Threshold: {item.threshold_hint || "—"}</p>
                  </div>
                ))}
              </div>
              {auditRecommendations.items.length > recommendationPreview.length ? (
                <p className="text-xs text-secondary">Showing top {recommendationPreview.length} recommendations from latest validated findings.</p>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}
      <ControlPanelView
        projectId={projectId}
        projectName={project.name}
        panel={panel}
        environment={environment}
      />
    </div>
  );
}
