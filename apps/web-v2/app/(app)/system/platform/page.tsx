import Link from "next/link";
import { Activity, ArrowLeft, Gauge, ServerCrash, ShieldAlert, Warehouse } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getSystemPlatform } from "@/lib/api";

function riskTone(value: string) {
  if (value === "critical") return "border-rose-800 bg-rose-500/10 text-rose-400";
  if (value === "high") return "border-amber-800 bg-amber-500/10 text-amber-400";
  return "border-emerald-800 bg-emerald-500/10 text-emerald-400";
}

function rate(value: number) {
  return `${value.toFixed(2)}/min`;
}

export default async function SystemPlatformPage() {
  const metrics = await getSystemPlatform();

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-sm">
        <div className="border-b border-zinc-800 bg-[linear-gradient(180deg,rgba(24,24,27,0.96),rgba(24,24,27,1))] px-6 py-6">
          <Link href="/system/pipeline" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100">
            <ArrowLeft className="h-4 w-4" />
            Back to system pipeline
          </Link>
          <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Platform health</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">Internal platform operating state</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
                Operator-grade readout for ingestion pressure, processor latency, warehouse lag, and overload risk.
              </p>
            </div>
            <div className={`rounded-full border px-5 py-3 text-sm font-semibold shadow-sm ${riskTone(metrics.customer_overload_risk)}`}>
              Customer overload risk: {metrics.customer_overload_risk.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 lg:grid-cols-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-5 py-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <Activity className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Ingest rate</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-zinc-100">{rate(metrics.trace_ingest_rate)}</p>
            <p className="mt-2 text-sm text-zinc-400">Average traces accepted per minute over the recent window.</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-5 py-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <Gauge className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Pipeline latency</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-zinc-100">
              {metrics.pipeline_latency !== null ? `${metrics.pipeline_latency}ms` : "n/a"}
            </p>
            <p className="mt-2 text-sm text-zinc-400">Mean consumer processing latency across active processors.</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-5 py-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <ServerCrash className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Failure rate</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-zinc-100">{(metrics.processor_failure_rate * 100).toFixed(2)}%</p>
            <p className="mt-2 text-sm text-zinc-400">Recent processor failures as a share of recent ingested traces.</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-5 py-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <Warehouse className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Warehouse lag</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-zinc-100">{metrics.warehouse_lag}</p>
            <p className="mt-2 text-sm text-zinc-400">Gap between recent accepted traces and recent warehouse rows.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="rounded-lg border-zinc-800 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Warehouse rows</p>
          <p className="mt-3 text-3xl font-semibold text-zinc-100">{metrics.warehouse_rows.toLocaleString()}</p>
          <p className="mt-2 text-sm text-zinc-400">Rows visible inside the current warehouse health window.</p>
        </Card>
        <Card className="rounded-lg border-zinc-800 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Active partitions</p>
          <p className="mt-3 text-3xl font-semibold text-zinc-100">{metrics.active_partitions}</p>
          <p className="mt-2 text-sm text-zinc-400">Date partitions currently active for recent operational reads.</p>
        </Card>
        <Card className="rounded-lg border-zinc-800 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Scan rate</p>
          <p className="mt-3 text-3xl font-semibold text-zinc-100">{metrics.scan_rate.toFixed(0)}</p>
          <p className="mt-2 text-sm text-zinc-400">Approximate rows scanned across the current health query window.</p>
        </Card>
        <Card className="rounded-lg border-zinc-800 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Avg query latency</p>
          <p className="mt-3 text-3xl font-semibold text-zinc-100">{metrics.avg_query_latency.toFixed(0)}ms</p>
          <p className="mt-2 text-sm text-zinc-400">Warehouse query latency currently reported by the adapter layer.</p>
        </Card>
      </div>

      <Card className="rounded-lg border-zinc-800 p-6">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-zinc-400" />
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Interpretation</p>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-100">How to read this panel</h2>
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