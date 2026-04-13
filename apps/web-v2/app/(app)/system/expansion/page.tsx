import Link from "next/link";
import { ArrowLeft, Radar, TowerControl, TrendingUp, Zap } from "lucide-react";

import { getSystemCustomerExpansion } from "@/lib/api";
import { Card } from "@/components/ui/card";

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
    ? "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20"
    : "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-700";
}

export default async function SystemExpansionPage() {
  const expansion = await getSystemCustomerExpansion().catch(() => ({
    average_expansion_ratio: 0,
    total_platform_growth_pct: 0,
    breakout_customers: 0,
    organizations: [],
  }));

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-sm">
        <div className="relative border-b border-zinc-800 bg-[linear-gradient(135deg,rgba(255,255,255,0.03),transparent_40%),radial-gradient(circle_at_top_right,rgba(20,184,166,0.06),transparent_34%),linear-gradient(180deg,rgba(24,24,27,0.96),rgba(24,24,27,1))] px-6 py-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Customer expansion</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">Telemetry expansion across customers</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
                Internal warehouse-rollup view of which organizations are expanding telemetry after onboarding and which
                accounts are showing infrastructure-style usage growth.
              </p>
            </div>
            <div className="rounded-full border border-zinc-800 bg-zinc-900/85 px-5 py-3 text-sm font-semibold text-zinc-100 shadow-sm backdrop-blur">
              Breakout threshold: 5x expansion
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 lg:grid-cols-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-5 py-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <TrendingUp className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Average expansion</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-zinc-100">{formatRatio(expansion.average_expansion_ratio)}</p>
            <p className="mt-2 text-sm text-zinc-400">Mean current-30-day volume divided by first-30-day volume.</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-5 py-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <TowerControl className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Platform growth</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-zinc-100">{formatPercent(expansion.total_platform_growth_pct)}</p>
            <p className="mt-2 text-sm text-zinc-400">Aggregate current-vs-initial telemetry growth across organizations.</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-5 py-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <Zap className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Breakout customers</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-zinc-100">{expansion.breakout_customers}</p>
            <p className="mt-2 text-sm text-zinc-400">Organizations currently above the 5x telemetry expansion threshold.</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-5 py-4">
            <div className="flex items-center gap-2 text-zinc-400">
              <Radar className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Tracked orgs</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-zinc-100">{expansion.organizations.length}</p>
            <p className="mt-2 text-sm text-zinc-400">Organizations with active tenant records in the current platform view.</p>
          </div>
        </div>
      </header>

      <Card className="overflow-hidden rounded-lg border-zinc-800">
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
              <thead className="bg-zinc-950 text-xs uppercase tracking-[0.16em] text-zinc-400">
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
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${breakoutTone(organization.breakout)}`}
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