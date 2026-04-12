import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Bug,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { getSystemCustomerExpansion, getSystemGrowth } from "@/lib/api";

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

function maxNumber(values: number[]) {
  return Math.max(...values, 1);
}

function CohortChart({
  points,
}: {
  points: Array<{ month_index: number; usage_index: number; organizations: number }>;
}) {
  const width = 680;
  const height = 220;
  const paddingX = 28;
  const paddingTop = 18;
  const paddingBottom = 34;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxUsage = maxNumber(points.map((point) => point.usage_index));
  const polyline = points
    .map((point, index) => {
      const x = paddingX + (index / Math.max(points.length - 1, 1)) * chartWidth;
      const y = paddingTop + chartHeight - (point.usage_index / maxUsage) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="Usage expansion by cohort">
        {[0, 0.5, 1].map((ratio) => {
          const y = paddingTop + chartHeight * ratio;
          return (
            <line
              key={ratio}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              stroke="rgba(148,163,184,0.35)"
              strokeDasharray="4 6"
            />
          );
        })}
        <polyline
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polyline}
        />
        {points.map((point, index) => {
          const x = paddingX + (index / Math.max(points.length - 1, 1)) * chartWidth;
          const y = paddingTop + chartHeight - (point.usage_index / maxUsage) * chartHeight;
          return (
            <g key={point.month_index}>
              <circle cx={x} cy={y} r="4.5" fill="#0f172a" />
              <text x={x} y={height - 10} textAnchor="middle" className="fill-slate-500 text-[10px] font-medium">
                M{point.month_index}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-4 flex flex-wrap gap-3">
        {points.filter((point) => point.organizations > 0).slice(0, 4).map((point) => (
          <div key={point.month_index} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-steel">
            <span className="font-mono text-ink">{point.usage_index.toFixed(1)}x</span> at month {point.month_index}
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionChart({
  points,
}: {
  points: Array<{ rank: number; organization_id: string; organization_name: string; traces_30d: number }>;
}) {
  const topPoints = points.slice(0, 12);
  const maxTraces = maxNumber(topPoints.map((point) => point.traces_30d));

  return (
    <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid h-56 grid-cols-12 items-end gap-3">
        {topPoints.map((point, index) => (
          <div key={point.organization_id} className="flex h-full flex-col justify-end gap-3">
            <div className="text-center text-[11px] font-medium text-ink">{compactNumber(point.traces_30d)}</div>
            <div
              className={`rounded-t-[16px] ${
                index < 3
                  ? "bg-[linear-gradient(180deg,#0f172a,#334155)]"
                  : "bg-[linear-gradient(180deg,rgba(71,85,105,0.7),rgba(148,163,184,0.95))]"
              }`}
              style={{ height: `${Math.max((point.traces_30d / maxTraces) * 100, point.traces_30d > 0 ? 8 : 0)}%` }}
            />
            <div className="text-center text-[10px] uppercase tracking-[0.16em] text-steel">#{point.rank}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {topPoints.slice(0, 6).map((point) => (
          <div key={point.organization_id} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 py-2">
            <span className="truncate pr-3 text-sm text-ink">{point.organization_name}</span>
            <span className="font-mono text-sm text-steel">{compactNumber(point.traces_30d)}</span>
          </div>
        ))}
      </div>
    </div>
  );
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
  const [growth, expansion] = await Promise.all([getSystemGrowth(), getSystemCustomerExpansion()]);
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

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Usage expansion by cohort</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Does usage compound after onboarding?</h2>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.16em] text-steel">Month 0 baseline</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-ink">1.0x</p>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
            Monthly cohort curve normalized to each organization&apos;s first eligible month. Rising values indicate usage expansion after onboarding.
          </p>
          <div className="mt-6">
            <CohortChart points={growth.usage_expansion_cohort} />
          </div>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Customer usage distribution</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Is a power-law forming?</h2>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.16em] text-steel">Coverage</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-ink">Top 50</p>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
            Thirty-day trace volume by organization, sorted descending. Steep curves highlight breakout customers and enterprise concentration.
          </p>
          <div className="mt-6">
            <DistributionChart points={growth.customer_usage_distribution} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-steel" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Platform expansion metrics</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Usage growth signals</h2>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-steel">Median expansion</p>
              <p className="mt-3 text-3xl font-semibold text-ink">{growth.expansion_metrics.median_expansion_ratio.toFixed(1)}x</p>
            </div>
            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-steel">Top expansion</p>
              <p className="mt-3 text-3xl font-semibold text-ink">{growth.expansion_metrics.top_expansion_ratio.toFixed(1)}x</p>
            </div>
            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-steel">Breakout accounts</p>
              <p className="mt-3 text-3xl font-semibold text-ink">{growth.expansion_metrics.breakout_accounts_detected}</p>
            </div>
            <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-steel">Telemetry (30d)</p>
              <p className="mt-3 text-3xl font-semibold text-ink">{compactNumber(growth.expansion_metrics.total_telemetry_30d)}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[28px] border-zinc-300 p-6">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-steel" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Top expanding customers</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Who is breaking out</h2>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {expansion.organizations.slice(0, 5).map((organization) => (
              <div key={organization.organization_id} className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{organization.organization_name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-steel">
                    {compactNumber(organization.current_30_day_volume)} traces / 30d
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-ink">{organization.expansion_ratio.toFixed(1)}x</p>
                  <p className={`text-xs uppercase tracking-[0.16em] ${organization.breakout ? "text-amber-700" : "text-steel"}`}>
                    {organization.breakout ? "Breakout" : "Growing"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

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