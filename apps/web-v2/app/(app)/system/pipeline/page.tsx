import Link from "next/link";
import { Activity, AlertTriangle, ArrowLeft, Cpu, DatabaseZap, Gauge, ShieldAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getSystemEventPipeline } from "@/lib/api";

function tone(health: string) {
  if (health === "degraded") return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
  if (health === "stalled") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  if (health === "healthy") return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
  return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
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
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[30px] border border-zinc-300 bg-white shadow-sm">
        <div className="relative border-b border-zinc-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.06),transparent_40%),radial-gradient(circle_at_top_right,rgba(148,163,184,0.2),transparent_38%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] px-6 py-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">System pipeline</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Trace event processing telemetry</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-steel">
                Internal readout for consumer throughput, derived lag, dead-letter routing, and recent failures
                across the trace event pipeline.
              </p>
            </div>
            <div className="rounded-full border border-zinc-300 bg-white/85 px-5 py-3 text-sm font-semibold text-ink shadow-sm backdrop-blur">
              {pipeline.topic} {pipeline.dead_letter_topic ? `→ ${pipeline.dead_letter_topic}` : "· DLQ disabled"}
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 lg:grid-cols-4">
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <DatabaseZap className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Published</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{pipeline.total_events_published}</p>
            <p className="mt-2 text-sm text-steel">Total ingested trace events on the primary topic.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <Activity className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Recent rate</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{pipeline.recent_events_published}</p>
            <p className="mt-2 text-sm text-steel">Published in the last {pipeline.window_minutes} minutes.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Degraded</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{degradedCount}</p>
            <p className="mt-2 text-sm text-steel">Consumers with recent errors or stalled progress.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <ShieldAlert className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">DLQ</p>
            </div>
            <p className="mt-3 text-lg font-semibold text-ink">{pipeline.dead_letter_topic ?? "disabled"}</p>
            <p className="mt-2 text-sm text-steel">Failed consumer payloads are copied here when enabled.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5 text-steel" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Consumer health</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Pipeline stages</h2>
            </div>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-zinc-50 text-xs uppercase tracking-[0.16em] text-steel">
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
                  <tr key={consumer.consumer_name} className="border-t border-zinc-200 align-top">
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-ink">{consumer.consumer_name.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-steel">{consumer.topic}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${tone(consumer.health)}`}>
                        {consumer.health}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-steel">
                      {decimal(consumer.processing_rate_per_minute)} ev/min
                      <p className="mt-1 text-xs text-steel/80">{consumer.processed_events_recent} recent</p>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium text-ink">{consumer.lag}</td>
                    <td className="px-4 py-4 text-sm text-steel">
                      {consumer.error_count_total}
                      <p className="mt-1 text-xs text-steel/80">{consumer.error_count_recent} recent</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-steel">
                      {consumer.average_processing_latency_ms !== null
                        ? `${Math.round(consumer.average_processing_latency_ms)} ms`
                        : "n/a"}
                    </td>
                    <td className="px-4 py-4 text-sm text-steel">{formatDate(consumer.last_processed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <Gauge className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Operating rule</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Health semantics</h2>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm text-steel">
              <div className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="font-medium text-ink">Healthy</p>
                <p className="mt-1">Recent successful work and no recent consumer errors.</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="font-medium text-ink">Degraded</p>
                <p className="mt-1">Recent processing errors were recorded and payloads may be in the DLQ.</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="font-medium text-ink">Stalled</p>
                <p className="mt-1">Published trace volume exists, but the consumer has not completed recent work.</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 px-4 py-3">
                <p className="font-medium text-ink">Idle</p>
                <p className="mt-1">No successful or failed work has been recorded for that consumer yet.</p>
              </div>
            </div>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Recent window</p>
            <div className="mt-5 space-y-3">
              {pipeline.consumers.map((consumer) => (
                <div key={`${consumer.consumer_name}-window`} className="rounded-2xl border border-zinc-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink">{consumer.consumer_name.replaceAll("_", " ")}</p>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${tone(consumer.health)}`}>
                      {consumer.health}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-steel">
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