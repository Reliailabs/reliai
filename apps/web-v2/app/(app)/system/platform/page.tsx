import Link from "next/link";
import { Activity, ArrowLeft, Gauge, ServerCrash, ShieldAlert, Warehouse } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getSystemPlatform } from "@/lib/api";

function riskTone(value: string) {
  if (value === "critical") return "border-rose-300 bg-rose-50 text-rose-900";
  if (value === "high") return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-emerald-300 bg-emerald-50 text-emerald-900";
}

function rate(value: number) {
  return `${value.toFixed(2)}/min`;
}

export default async function SystemPlatformPage() {
  const metrics = await getSystemPlatform();

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[30px] border border-zinc-300 bg-white shadow-sm">
        <div className="border-b border-zinc-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] px-6 py-6">
          <Link href="/system/pipeline" className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Back to system pipeline
          </Link>
          <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Platform health</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Internal platform operating state</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-steel">
                Operator-grade readout for ingestion pressure, processor latency, warehouse lag, and overload risk.
              </p>
            </div>
            <div className={`rounded-full border px-5 py-3 text-sm font-semibold shadow-sm ${riskTone(metrics.customer_overload_risk)}`}>
              Customer overload risk: {metrics.customer_overload_risk.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 lg:grid-cols-4">
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <Activity className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Ingest rate</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{rate(metrics.trace_ingest_rate)}</p>
            <p className="mt-2 text-sm text-steel">Average traces accepted per minute over the recent window.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <Gauge className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Pipeline latency</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">
              {metrics.pipeline_latency !== null ? `${metrics.pipeline_latency}ms` : "n/a"}
            </p>
            <p className="mt-2 text-sm text-steel">Mean consumer processing latency across active processors.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <ServerCrash className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Failure rate</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{(metrics.processor_failure_rate * 100).toFixed(2)}%</p>
            <p className="mt-2 text-sm text-steel">Recent processor failures as a share of recent ingested traces.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <Warehouse className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Warehouse lag</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{metrics.warehouse_lag}</p>
            <p className="mt-2 text-sm text-steel">Gap between recent accepted traces and recent warehouse rows.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-steel">Warehouse rows</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{metrics.warehouse_rows.toLocaleString()}</p>
          <p className="mt-2 text-sm text-steel">Rows visible inside the current warehouse health window.</p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-steel">Active partitions</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{metrics.active_partitions}</p>
          <p className="mt-2 text-sm text-steel">Date partitions currently active for recent operational reads.</p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-steel">Scan rate</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{metrics.scan_rate.toFixed(0)}</p>
          <p className="mt-2 text-sm text-steel">Approximate rows scanned across the current health query window.</p>
        </Card>
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-steel">Avg query latency</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{metrics.avg_query_latency.toFixed(0)}ms</p>
          <p className="mt-2 text-sm text-steel">Warehouse query latency currently reported by the adapter layer.</p>
        </Card>
      </div>

      <Card className="rounded-[28px] border-zinc-300 p-6">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-steel" />
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Interpretation</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">How to read this panel</h2>
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-sm font-semibold text-ink">Healthy state</p>
            <p className="mt-2 text-sm leading-6 text-steel">
              Ingest rate is stable, warehouse lag is near zero, and processor failure rate remains below operational noise.
            </p>
          </div>
          <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-sm font-semibold text-ink">Escalation trigger</p>
            <p className="mt-2 text-sm leading-6 text-steel">
              High lag or rising failure rate indicates a customer overload or processor dispatch problem before incidents fan out.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}