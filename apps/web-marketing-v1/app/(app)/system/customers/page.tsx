import Link from "next/link";
import { AlertTriangle, ArrowLeft, ChevronRight, FolderKanban, ShieldAlert, Workflow } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getSystemCustomers } from "@/lib/api";

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function percent(value: number) {
  return `${(value * 100).toFixed(value > 0 && value < 0.01 ? 2 : 1)}%`;
}

function riskTone(riskLevel: string) {
  if (riskLevel === "high") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (riskLevel === "medium") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
}

export default async function SystemCustomersPage() {
  const { projects } = await getSystemCustomers().catch(() => ({ projects: [] }));
  const highRiskCount = projects.filter((project) => project.risk_level === "high").length;
  const totalTraceVolume = projects.reduce((sum, project) => sum + project.trace_volume_24h, 0);
  const totalFailures = projects.reduce((sum, project) => sum + project.processor_failures, 0);

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[30px] border border-zinc-300 bg-white shadow-sm">
        <div className="relative border-b border-zinc-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.06),transparent_40%),radial-gradient(circle_at_top_right,rgba(180,83,9,0.12),transparent_34%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] px-6 py-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Customer reliability</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Project health by customer surface</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-steel">
                Internal operator view of warehouse throughput, guardrail pressure, incident density, processor
                instability, and derived platform risk across active projects.
              </p>
            </div>
            <div className="rounded-full border border-zinc-300 bg-white/85 px-5 py-3 text-sm font-semibold text-ink shadow-sm backdrop-blur">
              Operator-only customer health board
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 lg:grid-cols-4">
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <FolderKanban className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Projects</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{projects.length}</p>
            <p className="mt-2 text-sm text-steel">Customer projects visible to the current operator scope.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <Workflow className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Trace volume</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{compactNumber(totalTraceVolume)}</p>
            <p className="mt-2 text-sm text-steel">Warehouse traces recorded over the last 24 hours.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">High risk</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{highRiskCount}</p>
            <p className="mt-2 text-sm text-steel">Projects currently crossing the highest composite risk thresholds.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <ShieldAlert className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Processor failures</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{totalFailures}</p>
            <p className="mt-2 text-sm text-steel">External processor failures recorded across the same summary window.</p>
          </div>
        </div>
      </header>

      <Card className="overflow-hidden rounded-[28px] border-zinc-300">
        {projects.length === 0 ? (
          <div className="px-6 py-12">
            <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10">
              <h2 className="text-xl font-semibold text-ink">No customer health data yet</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">
                This view populates once traces land in the warehouse and project-level incidents, guardrails, or
                processor telemetry exist.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-zinc-50 text-xs uppercase tracking-[0.16em] text-steel">
                <tr>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Trace volume</th>
                  <th className="px-5 py-3 font-medium">Guardrails</th>
                  <th className="px-5 py-3 font-medium">Incidents</th>
                  <th className="px-5 py-3 font-medium">Processor failures</th>
                  <th className="px-5 py-3 font-medium">Pipeline lag</th>
                  <th className="px-5 py-3 font-medium">Risk</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.project_id} className="border-t border-zinc-200 align-top">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-ink">{project.project_name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-steel">{project.project_id}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-steel">
                      <p className="font-medium text-ink">{compactNumber(project.trace_volume_24h)}</p>
                      <p className="mt-1 text-xs text-steel/80">{compactNumber(project.traces_per_day)} traces/day</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-steel">{percent(project.guardrail_rate)}</td>
                    <td className="px-5 py-4 text-sm text-steel">{percent(project.incident_rate)}</td>
                    <td className="px-5 py-4 text-sm text-steel">
                      <p className="font-medium text-ink">{project.processor_failures}</p>
                      <p className="mt-1 text-xs text-steel/80">{percent(project.processor_failure_rate)} failure rate</p>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-ink">{compactNumber(project.pipeline_lag)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${riskTone(project.risk_level)}`}>
                        {project.risk_level}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/system/customers/${project.project_id}`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-steel"
                      >
                        Open
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
