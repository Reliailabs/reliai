import Link from "next/link";
import { notFound } from "next/navigation";

import { SystemLayoutShell } from "../../_components/system-layout-shell";
import { getSystemCustomersSurfaceData } from "@/lib/system-customers-data";

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
  if (riskLevel === "high") return "bg-destructive/10 text-destructive border border-destructive/40";
  if (riskLevel === "medium") return "bg-warning/10 text-warning border border-warning/40";
  return "bg-success/10 text-success border border-success/40";
}

export default async function SystemCustomerProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { projects, sourceErrors } = await getSystemCustomersSurfaceData();
  const project = projects.find((candidate) => candidate.project_id === projectId);

  if (!project) {
    notFound();
  }

  return (
    <SystemLayoutShell
      title={project.project_name}
      description="Project-level customer reliability snapshot derived from warehouse volume, guardrails, incidents, and processor stability."
    >
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">{project.project_name}</p>
          <p className="text-xs text-muted-foreground">{project.project_id}</p>
        </div>
        <Link href="/pulse/system/customers" className="text-xs font-medium text-primary hover:underline">
          Back to customers
        </Link>
      </div>

      {sourceErrors.length > 0 ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Some telemetry sources are unavailable.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Trace volume (24h)</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{compactNumber(project.trace_volume_24h)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Guardrail rate</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{percent(project.guardrail_rate)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Incident rate</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{percent(project.incident_rate)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Processor failures</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{project.processor_failures}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Risk posture</h2>
        <div className="mt-3 flex items-center gap-3">
          <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-medium ${riskTone(project.risk_level)}`}>
            {project.risk_level}
          </span>
          <p className="text-sm text-muted-foreground">
            Pipeline lag {compactNumber(project.pipeline_lag)} · Daily traces {compactNumber(project.traces_per_day)}.
          </p>
        </div>
      </section>
    </SystemLayoutShell>
  );
}

