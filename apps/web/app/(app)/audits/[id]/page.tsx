import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  continueAuditReview,
  createAuditRun,
  getAudit,
  rerunAuditStage,
  startAuditRun,
} from "@/lib/api";

async function actionHandler(formData: FormData) {
  "use server";

  const auditId = String(formData.get("audit_id") ?? "");
  const runId = String(formData.get("run_id") ?? "");
  const action = String(formData.get("action") ?? "");
  const stageKey = String(formData.get("stage_key") ?? "");

  if (!auditId) {
    return;
  }

  if (action === "new_run") {
    await createAuditRun(auditId);
    revalidatePath(`/audits/${auditId}`);
    redirect(`/audits/${auditId}`);
  }

  if (!runId) {
    return;
  }

  if (action === "start") {
    await startAuditRun(auditId, runId);
  } else if (action === "continue") {
    await continueAuditReview(auditId, runId);
  } else if (action === "rerun" && stageKey) {
    await rerunAuditStage(auditId, runId, stageKey);
  }

  revalidatePath(`/audits/${auditId}`);
  revalidatePath(`/audits/${auditId}/results`);
  redirect(`/audits/${auditId}`);
}

function stageBadge(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "running") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "queued") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "failed") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-zinc-50 text-zinc-600 border-zinc-200";
}

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getAudit(id).catch(() => null);

  if (!detail) {
    return (
      <Card className="rounded-2xl border-line bg-surface p-6">
        <h1 className="text-lg font-semibold text-primary">Audit not found</h1>
      </Card>
    );
  }

  const latestRun = detail.latest_run;
  const findings = detail.findings_summary;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-line bg-surface px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Audit Detail</p>
            <h1 className="mt-3 text-xl font-semibold text-primary">{detail.audit.name}</h1>
            <p className="mt-2 text-sm text-secondary">
              {detail.audit.target_system_name} · {detail.audit.audit_type.replaceAll("_", " ")} · policy {detail.audit.policy_profile}
            </p>
            <p className="mt-1 text-xs text-secondary">
              Status: {detail.audit.status} · Latest run: {latestRun?.status ?? "none"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={actionHandler}>
              <input type="hidden" name="audit_id" value={detail.audit.id} />
              <input type="hidden" name="action" value="new_run" />
              <Button type="submit" variant="outline">New Run</Button>
            </form>
            {latestRun ? (
              <>
                <form action={actionHandler}>
                  <input type="hidden" name="audit_id" value={detail.audit.id} />
                  <input type="hidden" name="run_id" value={latestRun.id} />
                  <input type="hidden" name="action" value="start" />
                  <Button type="submit">Start Audit</Button>
                </form>
                <form action={actionHandler}>
                  <input type="hidden" name="audit_id" value={detail.audit.id} />
                  <input type="hidden" name="run_id" value={latestRun.id} />
                  <input type="hidden" name="action" value="continue" />
                  <Button type="submit" variant="outline">Continue Review</Button>
                </form>
                <Button asChild variant="outline">
                  <Link href={`/audits/${detail.audit.id}/results`}>View Results</Link>
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-2xl border-line bg-surface p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-secondary">Stage Tracker</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {detail.stages.map((stage) => (
              <div key={stage.id} className="rounded-xl border border-line bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-primary">{stage.stage_label}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${stageBadge(stage.status)}`}>
                    {stage.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-2 text-xs text-secondary">{stage.summary || "No output yet."}</p>
                <p className="mt-2 text-[11px] text-secondary">
                  {stage.started_at ? `Started ${new Date(stage.started_at).toLocaleString()}` : "Not started"}
                  {stage.completed_at ? ` · Completed ${new Date(stage.completed_at).toLocaleString()}` : ""}
                </p>
                {latestRun ? (
                  <form action={actionHandler} className="mt-3">
                    <input type="hidden" name="audit_id" value={detail.audit.id} />
                    <input type="hidden" name="run_id" value={latestRun.id} />
                    <input type="hidden" name="action" value="rerun" />
                    <input type="hidden" name="stage_key" value={stage.stage_key} />
                    <Button type="submit" size="sm" variant="outline">Re-run Stage</Button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-2xl border-line bg-surface p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-secondary">Findings Summary</h2>
          <div className="mt-4 space-y-2 text-sm text-secondary">
            <p>Total findings: <span className="font-semibold text-primary">{findings.total}</span></p>
            <p>Validated: <span className="font-semibold text-primary">{findings.validated}</span></p>
            <p>Open critical: <span className="font-semibold text-primary">{findings.critical_open}</span></p>
            <p>Blocking: <span className="font-semibold text-primary">{findings.blocking_open}</span></p>
            <p>Certification: <span className="font-semibold text-primary">{latestRun?.certification_status ?? "pending"}</span></p>
          </div>
          {latestRun ? (
            <div className="mt-4 rounded-lg border border-line bg-white p-3 text-xs text-secondary">
              Run ID: {latestRun.id}
            </div>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border-line bg-surface p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-secondary">Overview</h2>
          <dl className="mt-4 space-y-3 text-sm text-secondary">
            <div>
              <dt className="font-medium text-primary">Description</dt>
              <dd>{detail.audit.description || "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-primary">Use cases</dt>
              <dd>{detail.audit.use_cases?.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-primary">Risk focus areas</dt>
              <dd>{detail.audit.risk_focus_areas?.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-primary">Workflow summary</dt>
              <dd>{detail.audit.workflow_summary || "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-primary">Endpoints notes</dt>
              <dd>{detail.audit.endpoints_notes || "—"}</dd>
            </div>
          </dl>
        </Card>

        <Card className="rounded-2xl border-line bg-surface p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-secondary">Production Context</h2>
          {!detail.audit.linked_production_enabled ? (
            <p className="mt-3 text-sm text-secondary">This audit is not linked to a production project.</p>
          ) : !detail.linked_production_context ? (
            <p className="mt-3 text-sm text-secondary">Production linkage is enabled, but no snapshot has been captured yet.</p>
          ) : (
            <div className="mt-4 space-y-2 text-sm text-secondary">
              <p>
                Evidence window: {String(detail.linked_production_context.evidenceWindow?.start ?? "—")} →{" "}
                {String(detail.linked_production_context.evidenceWindow?.end ?? "—")}
              </p>
              <p>
                Incidents: {String(detail.linked_production_context.incidentSummary?.count ?? 0)} (critical{" "}
                {String(detail.linked_production_context.incidentSummary?.criticalCount ?? 0)})
              </p>
              <p>Trace samples: {String(detail.linked_production_context.traceSampleSummary?.sampleCount ?? 0)}</p>
              <p>Guardrail violations: {String(detail.linked_production_context.guardrailViolationSummary?.count ?? 0)}</p>
              <p>Regressions: {String(detail.linked_production_context.regressionSummary?.count ?? 0)}</p>
              <p>
                Top risky surfaces:{" "}
                {Array.isArray(detail.linked_production_context.topRiskySurfaces)
                  ? detail.linked_production_context.topRiskySurfaces.join(", ")
                  : "—"}
              </p>
            </div>
          )}
        </Card>
      </div>

      {latestRun ? (
        <Card className="rounded-2xl border-line bg-surface p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-secondary">Artifacts</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {detail.artifacts.map((artifact) => (
              <a
                key={artifact.id}
                href={`/api/v1/audits/${detail.audit.id}/artifacts/${artifact.id}/download`}
                className="rounded-full border border-line bg-white px-3 py-1 text-xs text-secondary hover:text-primary"
              >
                {artifact.title}
              </a>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
