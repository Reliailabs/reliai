import { Activity, AlertTriangle, Cpu, DatabaseZap, Gauge, ShieldAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import { SubPageHeader } from "@/components/ui/sub-page-header";
import { getSystemEventPipeline } from "@/lib/api";

function tone(health: string) {
  if (health === "degraded") return "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20";
  if (health === "stalled") return "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20";
  if (health === "healthy") return "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20";
  return "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700";
}

function formatDate(value: string | null) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString();
}

function decimal(value: number | null) {
  if (value === null) return "n/a";
  return value.toFixed(2);
}

export default async function SystemPipelinePage() {
  const { pipeline } = await getSystemEventPipeline();
  const degradedCount = pipeline.consumers.filter((item) => item.health !== "healthy" && item.health !== "idle").length;

  return (
    <div className="min-h-full p-6 space-y-6">
      <SubPageHeader
        label="System pipeline"
        title="Trace event processing telemetry"
        description="Internal readout for consumer throughput, derived lag, dead-letter routing, and recent failures across the trace event pipeline."
        backHref="/dashboard"
        backLabel="Back to dashboard"
        right={
          <div className="rounded-full border border-zinc-800 bg-zinc-900/85 px-5 py-3 text-sm font-semibold text-zinc-100 shadow-sm backdrop-blur">
            {pipeline.topic} {pipeline.dead_letter_topic ? `→ ${pipeline.dead_letter_topic}` : "· DLQ disabled"}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <DatabaseZap className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em]">Published</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-zinc-100">{pipeline.total_events_published}</p>
          <p className="mt-2 text-sm text-zinc-400">Total ingested trace events on the primary topic.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Activity className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em]">Recent rate</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-zinc-100">{pipeline.recent_events_published}</p>
          <p className="mt-2 text-sm text-zinc-400">Published in the last {pipeline.window_minutes} minutes.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em]">Degraded</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-zinc-100">{degradedCount}</p>
          <p className="mt-2 text-sm text-zinc-400">Consumers with recent errors or stalled progress.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <ShieldAlert className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em]">DLQ</p>
          </div>
          <p className="mt-3 text-lg font-semibold text-zinc-100">{pipeline.dead_letter_topic ?? "disabled"}</p>
          <p className="mt-2 text-sm text-zinc-400">Failed consumer payloads are copied here when enabled.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5 text-zinc-400" />
            <div>
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Consumer health</p>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Pipeline stages</h2>
            </div>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-zinc-950 text-xs uppercase tracking-[0.16em] text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Consumer</th>
                  <th className="px-4 py-3 font-medium">Health</th>
                  <th className="px-4 py-3 font-medium">Throughput</th>
                  <th className="px-4 py-3 font-medium">Lag</th>
                  <th className="px-4 py-3 font-medium">Errors</th>
                  <th className="px-4 py-3 font-medium">Latency</th>
                  <th className="px-4 py-3 font-medium">Last processed</th>
                </tr>
              </thead>
              <tbody>
                {pipeline.consumers.map((consumer) => (
                  <tr key={consumer.consumer_name} className="border-t border-zinc-800 align-top">
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-zinc-100">{consumer.consumer_name.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-400">{consumer.topic}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-medium ${tone(consumer.health)}`}>
                        {consumer.health}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400">
                      {decimal(consumer.processing_rate_per_minute)} ev/min
                      <p className="mt-1 text-xs text-zinc-400/80">{consumer.processed_events_recent} recent</p>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-zinc-100">{consumer.lag}</td>
                    <td className="px-4 py-4 text-sm text-zinc-400">
                      {consumer.error_count_total}
                      <p className="mt-1 text-xs text-zinc-400/80">{consumer.error_count_recent} recent</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400">
                      {consumer.average_processing_latency_ms !== null
                        ? `${Math.round(consumer.average_processing_latency_ms)} ms`
                        : "n/a"}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400">{formatDate(consumer.last_processed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Gauge className="h-5 w-5 text-zinc-400" />
              <div>
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Operating rule</p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-100">Health semantics</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm text-zinc-400">
              <div className="rounded-lg border border-zinc-800 px-4 py-3">
                <p className="font-medium text-zinc-100">Healthy</p>
                <p className="mt-1">Recent successful work and no recent consumer errors.</p>
              </div>
              <div className="rounded-lg border border-zinc-800 px-4 py-3">
                <p className="font-medium text-zinc-100">Degraded</p>
                <p className="mt-1">Recent processing errors were recorded and payloads may be in the DLQ.</p>
              </div>
              <div className="rounded-lg border border-zinc-800 px-4 py-3">
                <p className="font-medium text-zinc-100">Stalled</p>
                <p className="mt-1">Published trace volume exists, but the consumer has not completed recent work.</p>
              </div>
              <div className="rounded-lg border border-zinc-800 px-4 py-3">
                <p className="font-medium text-zinc-100">Idle</p>
                <p className="mt-1">No successful or failed work has been recorded for that consumer yet.</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Recent window</p>
            <div className="mt-5 space-y-3">
              {pipeline.consumers.map((consumer) => (
                <div key={`${consumer.consumer_name}-window`} className="rounded-lg border border-zinc-800 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-zinc-100">{consumer.consumer_name.replaceAll("_", " ")}</p>
                    <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-medium ${tone(consumer.health)}`}>
                      {consumer.health}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">
                    {consumer.processed_events_recent} processed · {consumer.error_count_recent} errors · last error{" "}
                    {formatDate(consumer.last_error_at)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}