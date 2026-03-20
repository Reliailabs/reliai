"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type UsageStatus = {
  used: number;
  limit: number | null;
  percent_used?: number;
  usage_percent?: number;
  projected_usage?: number;
  estimated_overage_cost?: number | null;
  status?: string;
};

type UpgradePrompt = {
  title: string;
  message: string;
  cta: string;
  plan: string;
};

const basePlanCosts: Record<string, number | null> = {
  free: 0,
  team: 49,
  production: 199,
  enterprise: null,
};

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "Custom";
  return `$${value.toFixed(2)}`;
}

export function UsageHeader({
  usageStatus,
  plan,
  upgradePrompt,
}: {
  usageStatus: UsageStatus;
  plan: string;
  upgradePrompt?: UpgradePrompt | null;
}) {
  const [open, setOpen] = useState(false);
  const percentUsed = useMemo(() => {
    const raw = usageStatus.usage_percent ?? usageStatus.percent_used ?? 0;
    return Math.max(0, Math.min(1, raw));
  }, [usageStatus]);

  const limit = usageStatus.limit ?? 0;
  const projectedUsage = usageStatus.projected_usage ?? usageStatus.used;
  const isOverLimit = limit > 0 && projectedUsage > limit;

  const status = percentUsed >= 1 ? "blocked" : percentUsed >= 0.9 ? "critical" : percentUsed >= 0.7 ? "warning" : "normal";
  const statusTone =
    status === "blocked"
      ? "bg-rose-100 text-rose-700"
      : status === "critical"
        ? "bg-rose-100 text-rose-700"
        : status === "warning"
          ? "bg-amber-100 text-amber-800"
          : "bg-emerald-100 text-emerald-700";
  const barTone =
    status === "blocked"
      ? "bg-rose-500"
      : status === "critical"
        ? "bg-rose-500"
        : status === "warning"
          ? "bg-amber-500"
          : "bg-emerald-500";

  const baseCost = basePlanCosts[plan] ?? null;
  const estimatedUsageCost = usageStatus.estimated_overage_cost ?? 0;
  const totalEstimated =
    baseCost === null ? null : Number.isFinite(baseCost) ? baseCost + estimatedUsageCost : null;
  const showUpgrade = percentUsed >= 0.7 || isOverLimit;

  return (
    <div className="w-full max-w-[360px] rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
      <button type="button" className="w-full text-left" onClick={() => setOpen((prev) => !prev)}>
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.18em] text-steel">Usage</p>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusTone}`}>{status}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="font-medium text-ink">
            {formatCompact(usageStatus.used)} / {limit ? formatCompact(limit) : "no limit"} traces
          </span>
          <span className="text-xs text-steel">{Math.round(percentUsed * 100)}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
          <div className={`h-full ${barTone}`} style={{ width: `${Math.min(percentUsed * 100, 100)}%` }} />
        </div>
        {showUpgrade && upgradePrompt ? (
          <div className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-steel">
            {upgradePrompt.message}
          </div>
        ) : null}
      </button>

      {open ? (
        <div className="mt-4 space-y-4 border-t border-zinc-200 pt-4 text-xs text-steel">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Traces used</span>
              <span className="font-medium text-ink">{formatCompact(usageStatus.used)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Plan limit</span>
              <span className="font-medium text-ink">{limit ? formatCompact(limit) : "No limit"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Projected usage</span>
              <span className="font-medium text-ink">{formatCompact(projectedUsage)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Estimated overage</span>
              <span className="font-medium text-ink">{formatMoney(estimatedUsageCost)}</span>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-steel">Billing</p>
            <div className="mt-2 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-steel">Base subscription</span>
                <span className="font-medium text-ink">{formatMoney(baseCost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-steel">Estimated usage</span>
                <span className="font-medium text-ink">{formatMoney(estimatedUsageCost)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-100 pt-2">
                <span className="text-xs text-steel">Estimated total</span>
                <span className="font-medium text-ink">{formatMoney(totalEstimated)}</span>
              </div>
            </div>
          </div>
          {showUpgrade ? (
            <Button asChild className="w-full">
              <Link href="/settings?billing=upgrade">{upgradePrompt?.cta ?? "Upgrade now"}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
