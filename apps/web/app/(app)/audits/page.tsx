import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listAudits } from "@/lib/api";

const statusOptions = ["all", "draft", "active", "completed", "archived", "failed"];

function prettyLabel(value: string) {
  return value.replaceAll("_", " ");
}

function currentStageLabel(item: { latest_run_stages: Array<{ stage_key: string; status: string }> }) {
  const active = item.latest_run_stages.find((stage) => stage.status === "running" || stage.status === "queued");
  if (active) return active.stage_key;
  const lastCompleted = [...item.latest_run_stages].reverse().find((stage) => stage.status === "completed");
  return lastCompleted?.stage_key ?? "not_started";
}

export default async function AuditsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = searchParams ? await searchParams : {};
  const status = typeof raw.status === "string" ? raw.status : "all";
  const auditType = typeof raw.auditType === "string" ? raw.auditType : "";
  const search = typeof raw.search === "string" ? raw.search : "";

  const audits = await listAudits({
    status: status === "all" ? undefined : status,
    auditType: auditType || undefined,
    search: search || undefined,
  }).catch(() => ({ items: [] }));

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-line bg-surface px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Audits</p>
            <h1 className="mt-3 text-lg font-semibold text-primary">Audit Runs</h1>
            <p className="mt-2 text-sm text-secondary">Track certification posture, run state, and decision readiness across audited systems.</p>
          </div>
          <Button asChild>
            <Link href="/audits/new">New Audit</Link>
          </Button>
        </div>
      </header>

      <Card className="rounded-2xl border-line bg-surface p-6">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]" method="get">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search audits"
            className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-primary"
          />
          <select
            name="status"
            defaultValue={status}
            className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-primary"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All statuses" : option}
              </option>
            ))}
          </select>
          <select
            name="auditType"
            defaultValue={auditType}
            className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-primary"
          >
            <option value="">All audit types</option>
            <option value="production_readiness">Production readiness</option>
            <option value="hallucination_reliability">Hallucination & reliability</option>
            <option value="guardrails_safety">Safety / guardrails</option>
            <option value="compliance_governance">Compliance / governance</option>
            <option value="custom">Custom</option>
          </select>
          <Button type="submit" variant="outline">Apply</Button>
        </form>
      </Card>

      {audits.items.length === 0 ? (
        <Card className="rounded-2xl border-line bg-surface p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-secondary">No audits</p>
          <h2 className="mt-3 text-lg font-semibold text-primary">Create your first reliability audit</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
            Audits provide structured evidence, validated findings, and a certification decision for production readiness.
          </p>
          <div className="mt-4">
            <Button asChild>
              <Link href="/audits/new">Create audit</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="rounded-2xl border-line bg-surface p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-3 text-left text-sm text-secondary">
              <thead>
                <tr className="text-xs uppercase tracking-[0.22em] text-secondary">
                  <th className="px-2 py-2">Audit</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Run status</th>
                  <th className="px-2 py-2">Current stage</th>
                  <th className="px-2 py-2">Risk</th>
                  <th className="px-2 py-2">Certification</th>
                  <th className="px-2 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {audits.items.map((item) => (
                  <tr key={item.audit.id} className="rounded-xl border border-line bg-white">
                    <td className="px-3 py-3 align-top">
                      <Link href={`/audits/${item.audit.id}`} className="font-semibold text-primary hover:underline">
                        {item.audit.name}
                      </Link>
                      <p className="mt-1 text-xs text-secondary">{item.audit.target_system_name}</p>
                    </td>
                    <td className="px-3 py-3 align-top">{prettyLabel(item.audit.audit_type)}</td>
                    <td className="px-3 py-3 align-top">{prettyLabel(item.latest_run?.status ?? item.audit.status)}</td>
                    <td className="px-3 py-3 align-top">{prettyLabel(currentStageLabel(item))}</td>
                    <td className="px-3 py-3 align-top">{item.latest_run?.risk_score ?? "—"}</td>
                    <td className="px-3 py-3 align-top">{prettyLabel(item.latest_run?.certification_status ?? "pending")}</td>
                    <td className="px-3 py-3 align-top">{new Date(item.audit.updated_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
