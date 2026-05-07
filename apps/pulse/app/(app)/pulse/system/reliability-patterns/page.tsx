import { SystemLayoutShell } from "../_components/system-layout-shell";
import { getSystemReliabilityPatternsSurfaceData } from "@/lib/system-reliability-patterns-data";

function percent(value: number) {
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`;
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function probabilityTone(value: number) {
  if (value >= 0.5) return "bg-destructive/10 text-destructive border-destructive/40";
  if (value >= 0.25) return "bg-warning/10 text-warning border-warning/40";
  return "bg-blue-500/10 text-blue-300 border-blue-500/40";
}

export default async function ReliabilityPatternsPage() {
  const { items, sourceErrors } = await getSystemReliabilityPatternsSurfaceData();
  const highProbabilityCount = items.filter((item) => item.failure_probability >= 0.25).length;
  const totalSamples = items.reduce((sum, item) => sum + item.sample_count, 0);

  return (
    <SystemLayoutShell
      title="Reliability"
      description="Cross-project failure patterns mined from warehouse traces for internal reliability intelligence."
    >
      {sourceErrors.length > 0 ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Unable to load this panel.
        </div>
      ) : null}

      {items.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card px-6 py-8 text-sm text-muted-foreground">
          No reliability patterns are available yet.
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Patterns</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{items.length}</p>
              <p className="mt-2 text-xs text-muted-foreground">Canonical reliability patterns in scope.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Elevated</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{highProbabilityCount}</p>
              <p className="mt-2 text-xs text-muted-foreground">Patterns at or above 25% failure probability.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Sample volume</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{compactNumber(totalSamples)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Total trace observations across visible patterns.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Coverage</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{new Set(items.map((item) => item.pattern_type)).size}</p>
              <p className="mt-2 text-xs text-muted-foreground">Pattern families across model and prompt surfaces.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground">Pattern board</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead className="bg-muted/30 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Pattern</th>
                    <th className="px-3 py-2 font-medium">Model</th>
                    <th className="px-3 py-2 font-medium">Failure type</th>
                    <th className="px-3 py-2 font-medium">Probability</th>
                    <th className="px-3 py-2 font-medium">Sample size</th>
                    <th className="px-3 py-2 font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="px-3 py-3">
                        <p className="text-sm font-medium capitalize text-foreground">{item.pattern_type.replaceAll("_", " ")}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.prompt_pattern_hash ?? "no prompt hash"}</p>
                      </td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">{item.model_family ?? "unknown"}</td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">{item.failure_type.replaceAll("_", " ")}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-medium ${probabilityTone(item.failure_probability)}`}>
                          {percent(item.failure_probability)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm font-medium text-foreground">{compactNumber(item.sample_count)}</td>
                      <td className="px-3 py-3 text-sm text-muted-foreground">{new Date(item.last_seen_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </SystemLayoutShell>
  );
}
