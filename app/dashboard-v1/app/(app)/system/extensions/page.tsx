import { Activity, Blocks, PlugZap, ShieldAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import { SectionHeading, SectionLabel } from "@/components/ui/heading";
import { Stat } from "@/components/ui/stat";
import { SubPageHeader } from "@/components/ui/sub-page-header";
import { getSystemExtensions } from "@/lib/api";

function tone(health: string) {
  if (health === "degraded") return "bg-amber-500/10 text-amber-400 border border-amber-500/30";
  if (health === "disabled") return "bg-zinc-900 text-zinc-100 border border-zinc-800";
  return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
}

export default async function SystemExtensionsPage() {
  const data = await getSystemExtensions().catch(() => ({ items: [] }));
  const installed = data.items.filter((item) => item.processor_type !== "internal");
  const healthy = data.items.filter((item) => item.health === "healthy").length;
  const degraded = data.items.filter((item) => item.health === "degraded").length;

  return (
    <div className="min-h-full p-6 space-y-6">
      <SubPageHeader
        label="Processor extension platform"
        title="Installed extensions and runtime health"
        description="Formal view of core processors, organization processors, and installed platform extensions. Use this to verify allowed events, runtime limits, dispatch throughput, and extension stability without opening raw logs."
        backHref="/system/platform"
        backLabel="Back to platform health"
        right={
          <div className="rounded-full border border-zinc-800 bg-zinc-900/85 px-5 py-3 text-sm font-semibold text-zinc-100 shadow-sm backdrop-blur">
            Admin-only runtime surface
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Blocks className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Installed extensions</p>
          </div>
          <Stat variant="xl">{installed.length}</Stat>
          <p className="mt-2 text-sm text-zinc-400">Customer-installed reliability processors and integrations.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <ShieldAlert className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Healthy</p>
          </div>
          <Stat variant="xl">{healthy}</Stat>
          <p className="mt-2 text-sm text-zinc-400">Extensions dispatching without recent failures.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Activity className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Degraded</p>
          </div>
          <Stat variant="xl">{degraded}</Stat>
          <p className="mt-2 text-sm text-zinc-400">Extensions with recent failures or dispatch instability.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <PlugZap className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Hourly throughput</p>
          </div>
          <Stat variant="xl">
            {data.items.reduce((sum, item) => sum + item.event_throughput_per_hour, 0)}
          </Stat>
          <p className="mt-2 text-sm text-zinc-400">Observed extension invocations in the current runtime hour bucket.</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-zinc-800 px-6 py-5">
          <SectionLabel>Extension registry</SectionLabel>
          <SectionHeading>Processor load order and health</SectionHeading>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left">
            <thead className="bg-zinc-950 text-xs uppercase tracking-[0.16em] text-zinc-500">
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
                  <tr key={`${item.processor_type}:${item.id}:${item.name}`} className="border-t border-zinc-800 align-top">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-zinc-100">{item.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-400">
                        v{item.version} {item.project_id ? `· project ${item.project_id.slice(0, 8)}` : "· core runtime"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-400">{item.processor_type}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-medium ${tone(item.health)}`}>
                        {item.health.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-400">
                      <p>{allowedEvents}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-400">
                        timeout {String((runtimeLimits as { timeout_seconds?: number }).timeout_seconds ?? "n/a")}s · retries{" "}
                        {String((runtimeLimits as { max_retries?: number }).max_retries ?? "n/a")}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-zinc-100">{item.event_throughput_per_hour}/hr</td>
                    <td className="px-5 py-4 text-sm text-zinc-400">
                      <p>{item.recent_failure_count} recent failures</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-400">
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