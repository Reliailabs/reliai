import { SystemLayoutShell } from "../_components/system-layout-shell";
import { getSystemExtensionsSurfaceData } from "@/lib/system-extensions-data";

function tone(health: string) {
  if (health === "degraded") return "bg-warning/10 text-warning border border-warning/40";
  if (health === "disabled") return "bg-muted text-muted-foreground border border-border";
  return "bg-success/10 text-success border border-success/40";
}

export default async function SystemExtensionsPage() {
  const { items, sourceErrors } = await getSystemExtensionsSurfaceData();
  const installed = items.filter((item) => item.processor_type !== "internal");
  const healthy = items.filter((item) => item.health === "healthy").length;
  const degraded = items.filter((item) => item.health === "degraded").length;
  const throughput = items.reduce((sum, item) => sum + item.event_throughput_per_hour, 0);

  return (
    <SystemLayoutShell
      title="Extensions"
      description="Installed extensions and runtime health across processor dispatch pipelines."
    >
      {sourceErrors.length > 0 ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Unable to load this panel.
        </div>
      ) : null}

      {items.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card px-6 py-8 text-sm text-muted-foreground">
          No extensions are reporting runtime telemetry yet.
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Installed extensions</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{installed.length}</p>
          <p className="mt-2 text-xs text-muted-foreground">Customer-installed reliability processors and integrations.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Healthy</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{healthy}</p>
          <p className="mt-2 text-xs text-muted-foreground">Extensions dispatching without recent failures.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Degraded</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{degraded}</p>
          <p className="mt-2 text-xs text-muted-foreground">Extensions with recent failures or instability.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Hourly throughput</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{throughput}</p>
          <p className="mt-2 text-xs text-muted-foreground">Observed extension invocations in the current hour bucket.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Extension registry</h2>
        {items.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-muted/30 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Processor</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Health</th>
                  <th className="px-3 py-2 font-medium">Events</th>
                  <th className="px-3 py-2 font-medium">Throughput</th>
                  <th className="px-3 py-2 font-medium">Errors</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const config = item.config_json as {
                    allowed_events?: unknown[];
                    runtime_limits?: { timeout_seconds?: number; max_retries?: number };
                  };
                  const allowedEvents = Array.isArray(config.allowed_events)
                    ? config.allowed_events.map((value) => String(value)).join(", ")
                    : item.event_type;
                  const timeout = config.runtime_limits?.timeout_seconds ?? "n/a";
                  const retries = config.runtime_limits?.max_retries ?? "n/a";
                  return (
                    <tr key={`${item.processor_type}:${item.id}:${item.name}`} className="border-t border-border align-top">
                      <td className="px-3 py-3">
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          v{item.version} {item.project_id ? `· project ${item.project_id.slice(0, 8)}` : "· core runtime"}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">{item.processor_type}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-medium ${tone(item.health)}`}>
                          {item.health.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        <p>{allowedEvents}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          timeout {String(timeout)}s · retries {String(retries)}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-sm text-foreground">{item.event_throughput_per_hour}/hr</td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        <p>{item.recent_failure_count} recent failures</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.last_failure_at ? new Date(item.last_failure_at).toLocaleString() : "no recent failure"}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </SystemLayoutShell>
  );
}
