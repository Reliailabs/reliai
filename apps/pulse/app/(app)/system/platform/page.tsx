import { AlertTriangle } from "lucide-react";

import { SystemLayoutShell } from "../_components/system-layout-shell";
import { getSystemPlatformSurfaceData } from "@/lib/system-platform-data";

function riskTone(value: string) {
  if (value === "critical") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (value === "high") return "border-warning/40 bg-warning/10 text-warning";
  if (value === "medium") return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  if (value === "low") return "border-blue-500/40 bg-blue-500/10 text-blue-300";
  return "border-success/40 bg-success/10 text-success";
}

function metricCard(label: string, value: string, description: string) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export default async function SystemPlatformPage() {
  const { metrics, sourceErrors } = await getSystemPlatformSurfaceData();

  return (
    <SystemLayoutShell
      title="Platform"
      description="Internal platform operating state for ingestion pressure, processor latency, warehouse lag, and overload risk."
    >
      {sourceErrors.length > 0 ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Unable to load this panel.
        </div>
      ) : null}

      {metrics ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            {metricCard(
              "Ingest rate",
              `${metrics.trace_ingest_rate.toFixed(2)}/min`,
              "Average traces accepted per minute over the recent window.",
            )}
            {metricCard(
              "Pipeline latency",
              metrics.pipeline_latency !== null ? `${metrics.pipeline_latency}ms` : "n/a",
              "Mean consumer processing latency across active processors.",
            )}
            {metricCard(
              "Failure rate",
              `${(metrics.processor_failure_rate * 100).toFixed(2)}%`,
              "Recent processor failures as a share of recent ingested traces.",
            )}
            {metricCard(
              "Warehouse lag",
              String(metrics.warehouse_lag),
              "Gap between recent accepted traces and recent warehouse rows.",
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            {metricCard(
              "Warehouse rows",
              metrics.warehouse_rows.toLocaleString(),
              "Rows visible in the current warehouse health window.",
            )}
            {metricCard(
              "Active partitions",
              String(metrics.active_partitions),
              "Date partitions currently active for recent operational reads.",
            )}
            {metricCard(
              "Scan rate",
              metrics.scan_rate.toFixed(0),
              "Approximate rows scanned across the current health query window.",
            )}
            {metricCard(
              "Avg query latency",
              `${metrics.avg_query_latency.toFixed(0)}ms`,
              "Warehouse query latency currently reported by adapter layer.",
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Customer overload risk</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escalate when lag and failure rate rise together before incidents fan out.
                </p>
              </div>
              <div className={`rounded-full border px-4 py-2 text-sm font-semibold ${riskTone(metrics.customer_overload_risk)}`}>
                {metrics.customer_overload_risk.toUpperCase()}
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-2xl border border-border bg-card px-6 py-8 text-sm text-muted-foreground">
          Platform metrics are unavailable. Verify system-admin API access and retry.
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold text-foreground">Interpretation</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Healthy state means stable ingest, low lag, and controlled processor failure rate.
              Escalation starts when lag climbs and failure rate trend accelerates.
            </p>
          </div>
        </div>
      </section>
    </SystemLayoutShell>
  );
}
