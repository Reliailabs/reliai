import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createAudit, listProjects } from "@/lib/api";
import { requireOperatorSession } from "@/lib/auth";

async function createAuditAction(formData: FormData) {
  "use server";

  const useCases = String(formData.get("use_cases") ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const riskFocusAreas = String(formData.get("risk_focus_areas") ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const payload = {
    name: String(formData.get("name") ?? "").trim(),
    target_system_name: String(formData.get("target_system_name") ?? "").trim(),
    company_name: String(formData.get("company_name") ?? "").trim() || null,
    audit_type: String(formData.get("audit_type") ?? "production_readiness") as
      | "production_readiness"
      | "hallucination_reliability"
      | "guardrails_safety"
      | "compliance_governance"
      | "custom",
    policy_profile: String(formData.get("policy_profile") ?? "production_readiness") as
      | "production_readiness"
      | "hallucination_reliability"
      | "guardrails_safety"
      | "compliance_governance"
      | "custom",
    description: String(formData.get("description") ?? "").trim() || null,
    use_cases: useCases,
    workflow_summary: String(formData.get("workflow_summary") ?? "").trim() || null,
    endpoints_notes: String(formData.get("endpoints_notes") ?? "").trim() || null,
    risk_focus_areas: riskFocusAreas,
    project_id: String(formData.get("project_id") ?? "") || null,
    environment: String(formData.get("environment") ?? "") || null,
    linked_production_enabled: formData.get("linked_production_enabled") === "on",
    evidence_window_days: Number(formData.get("evidence_window_days") ?? 14),
    include_incidents: formData.get("include_incidents") === "on",
    include_trace_samples: formData.get("include_trace_samples") === "on",
    include_guardrail_violations: formData.get("include_guardrail_violations") === "on",
    include_regressions: formData.get("include_regressions") === "on",
    include_model_changes: formData.get("include_model_changes") === "on",
  };

  const result = await createAudit(payload);
  redirect(`/audits/${result.audit.id}`);
}

export default async function NewAuditPage() {
  const session = await requireOperatorSession();
  const organizationId = session.active_organization_id ?? session.memberships[0]?.organization_id;
  const projects = organizationId ? await listProjects({ organizationId, limit: 200 }).catch(() => ({ items: [] })) : { items: [] };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-line bg-surface px-6 py-5">
        <p className="text-xs uppercase tracking-[0.24em] text-secondary">Audits</p>
        <h1 className="mt-3 text-lg font-semibold text-primary">Create Audit</h1>
        <p className="mt-2 text-sm text-secondary">Define scope, production context, and evidence inputs for a new run.</p>
      </header>

      <form action={createAuditAction} className="space-y-6">
        <Card className="rounded-2xl border-line bg-surface p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-secondary">Basic information</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-secondary">
              Audit name
              <input required name="name" className="h-10 w-full rounded-lg border border-line px-3 text-primary" />
            </label>
            <label className="space-y-1 text-sm text-secondary">
              Target system
              <input required name="target_system_name" className="h-10 w-full rounded-lg border border-line px-3 text-primary" />
            </label>
            <label className="space-y-1 text-sm text-secondary">
              Company / team
              <input name="company_name" className="h-10 w-full rounded-lg border border-line px-3 text-primary" />
            </label>
            <label className="space-y-1 text-sm text-secondary">
              Audit type
              <select name="audit_type" className="h-10 w-full rounded-lg border border-line px-3 text-primary">
                <option value="production_readiness">Production Readiness Audit</option>
                <option value="hallucination_reliability">Hallucination & Output Reliability Audit</option>
                <option value="guardrails_safety">Safety / Guardrails Audit</option>
                <option value="compliance_governance">Compliance / Governance Audit</option>
                <option value="custom">Custom Audit</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-secondary">
              Policy profile
              <select name="policy_profile" className="h-10 w-full rounded-lg border border-line px-3 text-primary">
                <option value="production_readiness">production_readiness</option>
                <option value="hallucination_reliability">hallucination_reliability</option>
                <option value="guardrails_safety">guardrails_safety</option>
                <option value="compliance_governance">compliance_governance</option>
                <option value="custom">custom</option>
              </select>
            </label>
          </div>
        </Card>

        <Card className="rounded-2xl border-line bg-surface p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-secondary">System context</h2>
          <div className="mt-4 grid gap-4">
            <label className="space-y-1 text-sm text-secondary">
              System description
              <textarea name="description" rows={4} className="w-full rounded-lg border border-line px-3 py-2 text-primary" />
            </label>
            <label className="space-y-1 text-sm text-secondary">
              Primary use cases (one per line)
              <textarea name="use_cases" rows={4} className="w-full rounded-lg border border-line px-3 py-2 text-primary" />
            </label>
            <label className="space-y-1 text-sm text-secondary">
              Workflow summary
              <textarea name="workflow_summary" rows={3} className="w-full rounded-lg border border-line px-3 py-2 text-primary" />
            </label>
            <label className="space-y-1 text-sm text-secondary">
              Endpoints / integration notes
              <textarea name="endpoints_notes" rows={3} className="w-full rounded-lg border border-line px-3 py-2 text-primary" />
            </label>
            <label className="space-y-1 text-sm text-secondary">
              Risk focus areas (one per line)
              <textarea name="risk_focus_areas" rows={3} className="w-full rounded-lg border border-line px-3 py-2 text-primary" />
            </label>
          </div>
        </Card>

        <Card className="rounded-2xl border-line bg-surface p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-secondary">Production context</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-secondary">
              Linked project/system
              <select name="project_id" className="h-10 w-full rounded-lg border border-line px-3 text-primary">
                <option value="">Not linked</option>
                {projects.items.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-secondary">
              Environment
              <input name="environment" placeholder="production" className="h-10 w-full rounded-lg border border-line px-3 text-primary" />
            </label>
            <label className="space-y-1 text-sm text-secondary">
              Evidence window
              <select name="evidence_window_days" defaultValue="14" className="h-10 w-full rounded-lg border border-line px-3 text-primary">
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </label>
            <label className="mt-7 flex items-center gap-2 text-sm text-secondary">
              <input type="checkbox" name="linked_production_enabled" defaultChecked />
              Include production evidence snapshot
            </label>
            <label className="flex items-center gap-2 text-sm text-secondary"><input type="checkbox" name="include_incidents" defaultChecked />Include incidents</label>
            <label className="flex items-center gap-2 text-sm text-secondary"><input type="checkbox" name="include_trace_samples" defaultChecked />Include trace samples</label>
            <label className="flex items-center gap-2 text-sm text-secondary"><input type="checkbox" name="include_guardrail_violations" defaultChecked />Include guardrail violations</label>
            <label className="flex items-center gap-2 text-sm text-secondary"><input type="checkbox" name="include_regressions" defaultChecked />Include regressions</label>
            <label className="flex items-center gap-2 text-sm text-secondary"><input type="checkbox" name="include_model_changes" defaultChecked />Include model changes</label>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Create Audit</Button>
          <Button variant="outline" asChild>
            <Link href="/audits">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
