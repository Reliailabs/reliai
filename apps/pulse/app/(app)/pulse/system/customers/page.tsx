import { SystemLayoutShell } from "../_components/system-layout-shell";
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

export default async function SystemCustomersPage() {
  const { projects, sourceErrors } = await getSystemCustomersSurfaceData();
  const highRiskCount = projects.filter((project) => project.risk_level === "high").length;
  const totalTraceVolume = projects.reduce((sum, project) => sum + project.trace_volume_24h, 0);
  const totalFailures = projects.reduce((sum, project) => sum + project.processor_failures, 0);

  return (
    <SystemLayoutShell
      title="Customers"
      description="Project health by customer surface using warehouse throughput, guardrail pressure, incident density, and processor stability."
    >
      {sourceErrors.length > 0 ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Unable to load this panel.
        </div>
      ) : null}

      {projects.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card px-6 py-8 text-sm text-muted-foreground">
          No customer health data yet. This view populates once traces and reliability events are available.
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Projects</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{projects.length}</p>
          <p className="mt-2 text-xs text-muted-foreground">Customer projects in current operator scope.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Trace volume</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{compactNumber(totalTraceVolume)}</p>
          <p className="mt-2 text-xs text-muted-foreground">Warehouse traces over the last 24 hours.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">High risk</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{highRiskCount}</p>
          <p className="mt-2 text-xs text-muted-foreground">Projects crossing highest risk thresholds.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Processor failures</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{totalFailures}</p>
          <p className="mt-2 text-xs text-muted-foreground">Failures across the same summary window.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Customer reliability board</h2>
        {projects.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-muted/30 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Project</th>
                  <th className="px-3 py-2 font-medium">Trace volume</th>
                  <th className="px-3 py-2 font-medium">Guardrails</th>
                  <th className="px-3 py-2 font-medium">Incidents</th>
                  <th className="px-3 py-2 font-medium">Processor failures</th>
                  <th className="px-3 py-2 font-medium">Pipeline lag</th>
                  <th className="px-3 py-2 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {projects.map((project) => (
                  <tr key={project.project_id} className="align-top">
                    <td className="px-3 py-3">
                      <p className="text-sm font-medium text-foreground">{project.project_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{project.project_id}</p>
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">{compactNumber(project.trace_volume_24h)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{compactNumber(project.traces_per_day)} traces/day</p>
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">{percent(project.guardrail_rate)}</td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">{percent(project.incident_rate)}</td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">{project.processor_failures}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{percent(project.processor_failure_rate)} failure rate</p>
                    </td>
                    <td className="px-3 py-3 text-sm font-medium text-foreground">{compactNumber(project.pipeline_lag)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-medium ${riskTone(project.risk_level)}`}>
                        {project.risk_level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </SystemLayoutShell>
  );
}
