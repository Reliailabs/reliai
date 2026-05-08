import { Activity, Gauge, ServerCrash, ShieldAlert, Warehouse } from "lucide-react";

import { Card } from "@/components/ui/card";
import { SectionHeading, SectionLabel } from "@/components/ui/heading";
import { Stat } from "@/components/ui/stat";
import { SubPageHeader } from "@/components/ui/sub-page-header";
import { getSystemPlatform } from "@/lib/api";

function riskTone(value: string) {
  if (value === "critical") return "border-red-500/30 bg-red-500/10 text-red-400";
  if (value === "high") return "border-amber-500/30 bg-amber-500/10 text-amber-400";
  if (value === "medium") return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
  if (value === "low") return "border-blue-500/30 bg-blue-500/10 text-blue-400";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
}

function rate(value: number) {
  return `${value.toFixed(2)}/min`;
}

export default async function SystemPlatformPage() {
  const metrics = await getSystemPlatform();

  return (
    <div className="min-h-full p-6 space-y-6">
      <SubPageHeader
        label="Platform health"
        title="Internal platform operating state"
        description="Operator-grade readout for ingestion pressure, processor latency, warehouse lag, and overload risk."
        backHref="/system/pipeline"
        backLabel="Back to system pipeline"
        right={
          <div className={`rounded-full border px-5 py-3 text-sm font-semibold shadow-sm ${riskTone(metrics.customer_overload_risk)}`}>
            Customer overload risk: {metrics.customer_overload_risk.toUpperCase()}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Activity className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Ingest rate</p>
          </div>
          <Stat variant="xl">{rate(metrics.trace_ingest_rate)}</Stat>
          <p className="mt-2 text-sm text-zinc-400">Average traces accepted per minute over the recent window.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Gauge className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Pipeline latency</p>
          </div>
          <Stat variant="xl">
            {metrics.pipeline_latency !== null ? `${metrics.pipeline_latency}ms` : "n/a"}
          </Stat>
          <p className="mt-2 text-sm text-zinc-400">Mean consumer processing latency across active processors.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <ServerCrash className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Failure rate</p>
          </div>
          <Stat variant="xl">{(metrics.processor_failure_rate * 100).toFixed(2)}%</Stat>
          <p className="mt-2 text-sm text-zinc-400">Recent processor failures as a share of recent ingested traces.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Warehouse className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Warehouse lag</p>
          </div>
          <Stat variant="xl">{metrics.warehouse_lag}</Stat>
          <p className="mt-2 text-sm text-zinc-400">Gap between recent accepted traces and recent warehouse rows.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="p-5">
          <SectionLabel>Warehouse rows</SectionLabel>
          <Stat variant="xl">{metrics.warehouse_rows.toLocaleString()}</Stat>
          <p className="mt-2 text-sm text-zinc-400">Rows visible inside the current warehouse health window.</p>
        </Card>
        <Card className="p-5">
          <SectionLabel>Active partitions</SectionLabel>
          <Stat variant="xl">{metrics.active_partitions}</Stat>
          <p className="mt-2 text-sm text-zinc-400">Date partitions currently active for recent operational reads.</p>
        </Card>
        <Card className="p-5">
          <SectionLabel>Scan rate</SectionLabel>
          <Stat variant="xl">{metrics.scan_rate.toFixed(0)}</Stat>
          <p className="mt-2 text-sm text-zinc-400">Approximate rows scanned across the current health query window.</p>
        </Card>
        <Card className="p-5">
          <SectionLabel>Avg query latency</SectionLabel>
          <Stat variant="xl">{metrics.avg_query_latency.toFixed(0)}ms</Stat>
          <p className="mt-2 text-sm text-zinc-400">Warehouse query latency currently reported by the adapter layer.</p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-zinc-400" />
          <div>
            <SectionLabel>Interpretation</SectionLabel>
            <SectionHeading>How to read this panel</SectionHeading>
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-semibold text-zinc-100">Healthy state</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Ingest rate is stable, warehouse lag is near zero, and processor failure rate remains below operational noise.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-semibold text-zinc-100">Escalation trigger</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              High lag or rising failure rate indicates a customer overload or processor dispatch problem before incidents fan out.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}