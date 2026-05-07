import { SystemLayoutShell } from "../_components/system-layout-shell";
import { getSystemPipelineSurfaceData } from "@/lib/system-pipeline-data";

function formatDate(value: string | null) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString();
}

function tone(health: string) {
  if (health === "degraded") return "bg-destructive/10 text-destructive border border-destructive/40";
  if (health === "stalled") return "bg-warning/10 text-warning border border-warning/40";
  if (health === "healthy") return "bg-success/10 text-success border border-success/40";
  return "bg-muted text-muted-foreground border border-border";
}

export default async function SystemPipelinePage() {
  const { pipeline, sourceErrors } = await getSystemPipelineSurfaceData();
  const degradedCount =
    pipeline?.consumers.filter((item) => item.health !== "healthy" && item.health !== "idle").length ?? 0;

  return (
    <SystemLayoutShell
      title="Pipeline"
      description="Trace event processing telemetry for consumer throughput, lag, dead-letter routing, and recent failures."
    >
      {sourceErrors.length > 0 ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Unable to load this panel.
        </div>
      ) : null}

      {!pipeline ? (
        <section className="rounded-2xl border border-border bg-card px-6 py-8 text-sm text-muted-foreground">
          Pipeline telemetry is unavailable. Verify system-admin API access and retry.
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Published</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{pipeline.total_events_published}</p>
              <p className="mt-2 text-xs text-muted-foreground">Total ingested trace events.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recent rate</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{pipeline.recent_events_published}</p>
              <p className="mt-2 text-xs text-muted-foreground">Published in the last {pipeline.window_minutes} minutes.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Degraded</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{degradedCount}</p>
              <p className="mt-2 text-xs text-muted-foreground">Consumers with recent errors or stalled progress.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">DLQ</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{pipeline.dead_letter_topic ?? "disabled"}</p>
              <p className="mt-2 text-xs text-muted-foreground">Dead-letter routing status.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground">Pipeline stages</h2>
            {pipeline.consumers.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No consumers are reporting telemetry yet.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-collapse text-left">
                  <thead className="bg-muted/30 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Consumer</th>
                      <th className="px-3 py-2 font-medium">Health</th>
                      <th className="px-3 py-2 font-medium">Throughput</th>
                      <th className="px-3 py-2 font-medium">Lag</th>
                      <th className="px-3 py-2 font-medium">Errors</th>
                      <th className="px-3 py-2 font-medium">Last processed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipeline.consumers.map((consumer) => (
                      <tr key={consumer.consumer_name} className="border-t border-border align-top">
                        <td className="px-3 py-3">
                          <p className="text-sm font-medium text-foreground">
                            {consumer.consumer_name.replaceAll("_", " ")}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{consumer.topic}</p>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-medium ${tone(consumer.health)}`}>
                            {consumer.health}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-muted-foreground">
                          {consumer.processing_rate_per_minute.toFixed(2)} ev/min
                        </td>
                        <td className="px-3 py-3 text-sm text-foreground">{consumer.lag}</td>
                        <td className="px-3 py-3 text-sm text-muted-foreground">
                          {consumer.error_count_total} total / {consumer.error_count_recent} recent
                        </td>
                        <td className="px-3 py-3 text-sm text-muted-foreground">
                          {formatDate(consumer.last_processed_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </SystemLayoutShell>
  );
}
