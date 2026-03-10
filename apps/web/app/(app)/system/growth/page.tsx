import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Bug,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { getSystemGrowth } from "@/lib/api";

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function signedPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}%`;
}

function growthTone(value: number) {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-rose-700";
  return "text-steel";
}

function maxPoint(points: { count: number }[]) {
  return Math.max(...points.map((point) => point.count), 1);
}

function UsageBar({
  label,
  count,
  max,
}: {
  label: string;
  count: number;
  max: number;
}) {
  const width = `${Math.max((count / Math.max(max, 1)) * 100, count > 0 ? 8 : 0)}%`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-steel">{label}</span>
        <span className="font-medium text-ink">{count}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100">
        <div
          className="h-2 rounded-full bg-[linear-gradient(90deg,#0f172a,#334155)]"
          style={{ width }}
        />
      </div>
    </div>
  );
}

export default async function SystemGrowthPage() {
  const growth = await getSystemGrowth();
  const traceMax = maxPoint(growth.trace_volume.daily_points);
  const incidentMax = maxPoint(growth.incident_metrics.daily_points);
  const tierMax = Math.max(
    growth.usage_tiers.under_1m,
    growth.usage_tiers["1m_10m"],
    growth.usage_tiers["10m_100m"],
    growth.usage_tiers["100m_plus"],
    1,
  );

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-[30px] border border-zinc-300 bg-white shadow-sm">
        <div className="relative border-b border-zinc-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.08),transparent_35%),radial-gradient(circle_at_top_right,rgba(148,163,184,0.18),transparent_36%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] px-6 py-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-steel hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">System growth</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Internal warehouse growth readout</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-steel">
                Operator-facing internal dashboard for trace volume expansion, incident capture, guardrail intervention
                load, and active project usage tiers.
              </p>
            </div>
            <div className="rounded-full border border-zinc-300 bg-white/85 px-5 py-3 text-sm font-semibold text-ink shadow-sm backdrop-blur">
              Warehouse-derived system metrics
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 lg:grid-cols-4">
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <TrendingUp className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Trace volume</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{compactNumber(growth.trace_volume.today)}</p>
            <p className="mt-2 text-sm text-steel">Traces observed today across the warehouse.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <BarChart3 className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">7d baseline</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{compactNumber(growth.trace_volume.seven_day_avg)}</p>
            <p className="mt-2 text-sm text-steel">Average daily volume over the previous seven full UTC days.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <Bug className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Incident capture</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">{growth.incident_metrics.incidents_detected}</p>
            <p className="mt-2 text-sm text-steel">Incidents detected in the last seven UTC days.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex items-center gap-2 text-steel">
              <ShieldAlert className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Guardrail actions</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-ink">
              {growth.guardrail_metrics.retries + growth.guardrail_metrics.fallbacks + growth.guardrail_metrics.blocks}
            </p>
            <p className="mt-2 text-sm text-steel">Runtime interventions recorded over the same seven-day window.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="grid gap-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Trace volume chart</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Daily warehouse throughput</h2>
              </div>
              <p className={`text-sm font-semibold ${growthTone(growth.trace_volume.growth_pct)}`}>
                {signedPercent(growth.trace_volume.growth_pct)} vs 7d baseline
              </p>
            </div>
            <div className="mt-8 grid h-64 grid-cols-7 items-end gap-3">
              {growth.trace_volume.daily_points.map((point, index) => (
                <div key={point.date} className="flex h-full flex-col justify-end gap-3">
                  <div className="text-center text-xs font-medium text-ink">{compactNumber(point.count)}</div>
                  <div
                    className={`rounded-t-[18px] ${
                      index === growth.trace_volume.daily_points.length - 1
                        ? "bg-[linear-gradient(180deg,#0f172a,#334155)]"
                        : "bg-zinc-300"
                    }`}
                    style={{ height: `${Math.max((point.count / traceMax) * 100, point.count > 0 ? 8 : 0)}%` }}
                  />
                  <div className="text-center text-[11px] uppercase tracking-[0.16em] text-steel">
                    {new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Incident detection chart</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Recent incident intake</h2>
              </div>
              <div className="text-right">
                <p className="text-sm text-steel">Average MTTR</p>
                <p className="text-lg font-semibold text-ink">{growth.incident_metrics.avg_mttr_minutes} min</p>
              </div>
            </div>
            <div className="mt-8 grid h-56 grid-cols-7 items-end gap-3">
              {growth.incident_metrics.daily_points.map((point) => (
                <div key={point.date} className="flex h-full flex-col justify-end gap-3">
                  <div className="text-center text-xs font-medium text-ink">{point.count}</div>
                  <div
                    className="rounded-t-[16px] bg-[linear-gradient(180deg,rgba(180,83,9,0.75),rgba(120,53,15,0.95))]"
                    style={{ height: `${Math.max((point.count / incidentMax) * 100, point.count > 0 ? 10 : 0)}%` }}
                  />
                  <div className="text-center text-[11px] uppercase tracking-[0.16em] text-steel">
                    {new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Guardrail interventions</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Protection load</h2>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                <span className="text-sm text-steel">Retries</span>
                <span className="text-sm font-medium text-ink">{growth.guardrail_metrics.retries}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                <span className="text-sm text-steel">Fallbacks</span>
                <span className="text-sm font-medium text-ink">{growth.guardrail_metrics.fallbacks}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                <span className="text-sm text-steel">Blocks</span>
                <span className="text-sm font-medium text-ink">{growth.guardrail_metrics.blocks}</span>
              </div>
            </div>
          </Card>

          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-steel" />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Customer usage tiers</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">30-day project distribution</h2>
              </div>
            </div>
            <div className="mt-6 space-y-5">
              <UsageBar label="Under 1M traces" count={growth.usage_tiers.under_1m} max={tierMax} />
              <UsageBar label="1M to 10M traces" count={growth.usage_tiers["1m_10m"]} max={tierMax} />
              <UsageBar label="10M to 100M traces" count={growth.usage_tiers["10m_100m"]} max={tierMax} />
              <UsageBar label="100M+ traces" count={growth.usage_tiers["100m_plus"]} max={tierMax} />
            </div>
            <p className="mt-5 text-sm leading-6 text-steel">
              Tiering is based on 30-day warehouse trace counts per active project. Zero-volume active projects remain
              in the lowest tier so adoption gaps are visible.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
