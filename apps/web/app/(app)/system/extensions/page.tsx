import Link from "next/link";
import { Activity, ArrowLeft, Blocks, PlugZap, ShieldAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import { getSystemExtensions } from "@/lib/api";

function tone(health: string) {
  if (health === "degraded") return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  if (health === "disabled") return "bg-zinc-200 text-zinc-700 ring-1 ring-zinc-300";
  return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
}

export default async function SystemExtensionsPage() {
  const data = await getSystemExtensions().catch(() => ({ items: [] }));
  const installed = data.items.filter((item) => item.processor_type !== "internal");
  const healthy = data.items.filter((item) => item.health === "healthy").length;
  const degraded = data.items.filter((item) => item.health === "degraded").length;

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[30px] border border-zinc-300 bg-white shadow-sm">
        <div className="relative border-b border-zinc-200 bg-[linear-gradient(140deg,rgba(15,23,42,0.08),transparent_38%),radial-gradient(circle_at_top_right,rgba(20,184,166,0.16),transparent_34%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] px-6 py-6">
          <Link href="/system/platform" className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Back to platform health
          </Link>
          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Processor extension platform</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Installed extensions and runtime health</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-steel">
                Formal view of core processors, organization processors, and installed platform extensions. Use this to
                verify allowed events, runtime limits, dispatch throughput, and extension stability without opening raw logs.
              </p>
            </div>
            <div className="rounded-full border border-zinc-300 bg-white/85 px-5 py-3 text-sm font-semibold text-ink shadow-sm backdrop-blur">
              Admin-only runtime surface
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 lg:grid-cols-4">
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <Blocks className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Installed extensions</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{installed.length}</p>
            <p className="mt-2 text-sm text-steel">Customer-installed reliability processors and integrations.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <ShieldAlert className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Healthy</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{healthy}</p>
            <p className="mt-2 text-sm text-steel">Extensions dispatching without recent failures.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <Activity className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Degraded</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{degraded}</p>
            <p className="mt-2 text-sm text-steel">Extensions with recent failures or dispatch instability.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <PlugZap className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Hourly throughput</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">
              {data.items.reduce((sum, item) => sum + item.event_throughput_per_hour, 0)}
            </p>
            <p className="mt-2 text-sm text-steel">Observed extension invocations in the current runtime hour bucket.</p>
          </div>
        </div>
      </header>

      <Card className="overflow-hidden rounded-[28px] border-zinc-300">
        <div className="border-b border-zinc-200 px-6 py-5">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Extension registry</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Processor load order and health</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead className="bg-zinc-50 text-xs uppercase tracking-[0.16em] text-steel">
              <tr>
                <th className="px-5 py-3 font-medium">Processor</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Health</th>
                <th className="px-5 py-3 font-medium">Events</th>
                <th className="px-5 py-3 font-medium">Throughput</th>
                <th className="px-5 py-3 font-medium">Errors</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => {
                const config = item.config_json as {
                  allowed_events?: unknown[];
                  runtime_limits?: { timeout_seconds?: number; max_retries?: number };
                };
                const allowedEvents = Array.isArray(config.allowed_events)
                  ? config.allowed_events.map((value) => String(value)).join(", ")
                  : item.event_type;
                const runtimeLimits = config.runtime_limits ?? {};
                return (
                  <tr key={`${item.processor_type}:${item.id}:${item.name}`} className="border-t border-zinc-200 align-top">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-ink">{item.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-steel">
                        v{item.version} {item.project_id ? `· project ${item.project_id.slice(0, 8)}` : "· core runtime"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm text-steel">{item.processor_type}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${tone(item.health)}`}>
                        {item.health.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-steel">
                      <p>{allowedEvents}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-steel">
                        timeout {String((runtimeLimits as { timeout_seconds?: number }).timeout_seconds ?? "n/a")}s · retries{" "}
                        {String((runtimeLimits as { max_retries?: number }).max_retries ?? "n/a")}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-ink">{item.event_throughput_per_hour}/hr</td>
                    <td className="px-5 py-4 text-sm text-steel">
                      <p>{item.recent_failure_count} recent failures</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-steel">
                        {item.last_failure_at ? new Date(item.last_failure_at).toLocaleString() : "no recent failure"}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
