import { SystemLayoutShell } from "../_components/system-layout-shell";
import { getSystemExpansionSurfaceData } from "@/lib/system-expansion-data";

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function formatRatio(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}x`;
}

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(Math.abs(value) >= 100 ? 0 : 1)}%`;
}

function breakoutTone(breakout: boolean) {
  return breakout
    ? "bg-destructive/10 text-destructive border-destructive/40"
    : "bg-muted text-muted-foreground border-border";
}

export default async function SystemExpansionPage() {
  const { expansion, sourceErrors } = await getSystemExpansionSurfaceData();

  return (
    <SystemLayoutShell
      title="Expansion"
      description="Telemetry expansion across customers using warehouse rollups for first-30-day vs current-30-day growth."
    >
      {sourceErrors.length > 0 ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Unable to load this panel.
        </div>
      ) : null}

      {!expansion ? (
        <section className="rounded-2xl border border-border bg-card px-6 py-8 text-sm text-muted-foreground">
          Expansion telemetry is unavailable. Verify system-admin API access and retry.
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Average expansion</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatRatio(expansion.average_expansion_ratio)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Mean current-30-day volume divided by first-30-day volume.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Platform growth</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatPercent(expansion.total_platform_growth_pct)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Aggregate telemetry growth across organizations.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Breakout customers</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{expansion.breakout_customers}</p>
              <p className="mt-2 text-xs text-muted-foreground">Organizations above 5x expansion threshold.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tracked orgs</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{expansion.organizations.length}</p>
              <p className="mt-2 text-xs text-muted-foreground">Organizations with active rollup history.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground">Customer expansion board</h2>
            {expansion.organizations.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No customer expansion data yet. This page populates once organizations have enough rollup history.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-collapse text-left">
                  <thead className="bg-muted/30 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Customer</th>
                      <th className="px-3 py-2 font-medium">First 30 days</th>
                      <th className="px-3 py-2 font-medium">Current 30 days</th>
                      <th className="px-3 py-2 font-medium">Expansion</th>
                      <th className="px-3 py-2 font-medium">Growth</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {expansion.organizations.map((organization) => (
                      <tr key={organization.organization_id} className="align-top">
                        <td className="px-3 py-3">
                          <p className="text-sm font-medium text-foreground">{organization.organization_name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{organization.organization_id}</p>
                        </td>
                        <td className="px-3 py-3 text-sm font-medium text-foreground">
                          {compactNumber(organization.first_30_day_volume)}
                        </td>
                        <td className="px-3 py-3 text-sm font-medium text-foreground">
                          {compactNumber(organization.current_30_day_volume)}
                        </td>
                        <td className="px-3 py-3 text-sm font-medium text-foreground">
                          {formatRatio(organization.expansion_ratio)}
                        </td>
                        <td className="px-3 py-3 text-sm text-muted-foreground">
                          {formatPercent(organization.growth_rate)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-medium ${breakoutTone(organization.breakout)}`}
                          >
                            {organization.breakout ? "breakout" : "normal"}
                          </span>
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
