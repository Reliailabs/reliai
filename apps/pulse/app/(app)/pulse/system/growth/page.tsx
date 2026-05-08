import { SystemLayoutShell } from "../_components/system-layout-shell";
import { getSystemGrowthSurfaceData } from "@/lib/system-growth-data";

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function signedPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function tone(value: number) {
  if (value > 0) return "text-success";
  if (value < 0) return "text-destructive";
  return "text-muted-foreground";
}

export default async function SystemGrowthPage() {
  const { growth, expansion, sourceErrors } = await getSystemGrowthSurfaceData();

  return (
    <SystemLayoutShell
      title="Growth"
      description="Internal warehouse growth readout for trace volume expansion, incident capture, and guardrail intervention load."
    >
      {sourceErrors.length > 0 ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Unable to load this panel.
        </div>
      ) : null}

      {!growth ? (
        <section className="rounded-2xl border border-border bg-card px-6 py-8 text-sm text-muted-foreground">
          Growth telemetry is unavailable. Verify system-admin API access and retry.
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Trace volume</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{compactNumber(growth.trace_volume.today)}</p>
              <p className={`mt-2 text-xs ${tone(growth.trace_volume.growth_pct)}`}>
                {signedPercent(growth.trace_volume.growth_pct)} vs 7d baseline
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">7d baseline</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{compactNumber(growth.trace_volume.seven_day_avg)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Average daily volume over previous seven days.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Incidents detected</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{growth.incident_metrics.incidents_detected}</p>
              <p className="mt-2 text-xs text-muted-foreground">Avg MTTR {growth.incident_metrics.avg_mttr_minutes} min</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Guardrail actions</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {growth.guardrail_metrics.retries + growth.guardrail_metrics.fallbacks + growth.guardrail_metrics.blocks}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Retries {growth.guardrail_metrics.retries} · Fallbacks {growth.guardrail_metrics.fallbacks} · Blocks {growth.guardrail_metrics.blocks}
              </p>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground">Usage tiers</h2>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p>Under 1M: <span className="text-foreground">{growth.usage_tiers.under_1m}</span></p>
                <p>1M–10M: <span className="text-foreground">{growth.usage_tiers["1m_10m"]}</span></p>
                <p>10M–100M: <span className="text-foreground">{growth.usage_tiers["10m_100m"]}</span></p>
                <p>100M+: <span className="text-foreground">{growth.usage_tiers["100m_plus"]}</span></p>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground">Expansion summary</h2>
              {expansion ? (
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <p>Average expansion ratio: <span className="text-foreground">{expansion.average_expansion_ratio.toFixed(2)}x</span></p>
                  <p>Median expansion ratio: <span className="text-foreground">{expansion.median_expansion_ratio.toFixed(2)}x</span></p>
                  <p>Top expansion ratio: <span className="text-foreground">{expansion.top_expansion_ratio.toFixed(2)}x</span></p>
                  <p>Platform growth: <span className={tone(expansion.total_platform_growth_pct)}>{signedPercent(expansion.total_platform_growth_pct)}</span></p>
                  <p>Breakout customers: <span className="text-foreground">{expansion.breakout_customers}</span></p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Expansion summary is unavailable.</p>
              )}
            </div>
          </section>
        </>
      )}
    </SystemLayoutShell>
  );
}
