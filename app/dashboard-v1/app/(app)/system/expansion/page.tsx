import { Radar, TowerControl, TrendingUp, Zap } from "lucide-react";

import { getSystemCustomerExpansion } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { SubPageHeader } from "@/components/ui/sub-page-header";

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
    ? "bg-red-500/10 text-red-400 border-red-500/30"
    : "bg-zinc-900 text-zinc-100 border-zinc-800";
}

export default async function SystemExpansionPage() {
  const expansion = await getSystemCustomerExpansion().catch(() => ({
    average_expansion_ratio: 0,
    total_platform_growth_pct: 0,
    breakout_customers: 0,
    organizations: [],
  }));

  return (
    <div className="min-h-full p-6 space-y-6">
      <SubPageHeader
        label="Customer expansion"
        title="Telemetry expansion across customers"
        description="Internal warehouse-rollup view of which organizations are expanding telemetry after onboarding and which accounts are showing infrastructure-style usage growth."
        backHref="/pulse"
        backLabel="Back to dashboard"
        right={
          <div className="rounded-full border border-zinc-800 bg-zinc-900/85 px-5 py-3 text-sm font-semibold text-zinc-100 shadow-sm backdrop-blur">
            Breakout threshold: 5x expansion
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <TrendingUp className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Average expansion</p>
          </div>
          <Stat variant="xl">{formatRatio(expansion.average_expansion_ratio)}</Stat>
          <p className="mt-2 text-sm text-zinc-400">Mean current-30-day volume divided by first-30-day volume.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <TowerControl className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Platform growth</p>
          </div>
          <Stat variant="xl">{formatPercent(expansion.total_platform_growth_pct)}</Stat>
          <p className="mt-2 text-sm text-zinc-400">Aggregate current-vs-initial telemetry growth across organizations.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Zap className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Breakout customers</p>
          </div>
          <Stat variant="xl">{expansion.breakout_customers}</Stat>
          <p className="mt-2 text-sm text-zinc-400">Organizations currently above the 5x telemetry expansion threshold.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Radar className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Tracked orgs</p>
          </div>
          <Stat variant="xl">{expansion.organizations.length}</Stat>
          <p className="mt-2 text-sm text-zinc-400">Organizations with active tenant records in the current platform view.</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        {expansion.organizations.length === 0 ? (
          <div className="px-6 py-12">
            <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900 px-6 py-10">
              <h2 className="text-xl font-semibold text-zinc-100">No customer expansion data yet</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                This page populates once organizations have enough warehouse rollup history to compare first-30-day
                telemetry against the current 30-day window.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-zinc-950 text-xs uppercase tracking-[0.16em] text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">First 30 days</th>
                  <th className="px-5 py-3 font-medium">Current 30 days</th>
                  <th className="px-5 py-3 font-medium">Expansion</th>
                  <th className="px-5 py-3 font-medium">Growth</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {expansion.organizations.map((organization) => (
                  <tr key={organization.organization_id} className="border-t border-zinc-800 align-top">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-zinc-100">{organization.organization_name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-400">
                        {organization.organization_id}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-zinc-100">
                      {compactNumber(organization.first_30_day_volume)}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-zinc-100">
                      {compactNumber(organization.current_30_day_volume)}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-zinc-100">
                      {formatRatio(organization.expansion_ratio)}
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-400">{formatPercent(organization.growth_rate)}</td>
                    <td className="px-5 py-4">
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
      </Card>
    </div>
  );
}