"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { UpgradeSheet } from "@/components/billing/upgrade-sheet";
import { Button } from "@/components/ui/button";

type UsageStatus = {
  used: number;
  limit: number | null;
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
  enterprise: null
};

function formatNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "Custom";
  return `$${value.toFixed(2)}`;
}

export function UsageMeter({
  usageStatus,
  plan,
  upgradePrompt,
  organizationId
}: {
  usageStatus: UsageStatus;
  plan: string;
  upgradePrompt?: UpgradePrompt | null;
  organizationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const percentUsed = useMemo(() => {
    const raw = usageStatus.usage_percent ?? 0;
    return Math.max(0, Math.min(1, raw));
  }, [usageStatus.usage_percent]);

  const limit = usageStatus.limit ?? 0;
  const projectedUsage = usageStatus.projected_usage ?? usageStatus.used;
  const isOverLimit = limit > 0 && projectedUsage > limit;

  const state = useMemo(() => {
    if (!limit) return "enterprise";
    if (percentUsed >= 1) return "blocked";
    if (percentUsed >= 0.9) return "critical";
    if (percentUsed >= 0.7) return "warning";
    return "normal";
  }, [percentUsed, limit]);

  const colors: Record<string, string> = {
    normal: "bg-emerald-500",
    warning: "bg-amber-500",
    critical: "bg-rose-500",
    blocked: "bg-rose-600",
    enterprise: "bg-sky-500"
  };

  const message: Record<string, string> = {
    normal: "",
    warning: "You’re on track to exceed your plan.",
    critical: "You’re about to lose observability.",
    blocked: "Trace limit reached. Observability paused.",
    enterprise: ""
  };

  const cta: Record<string, string> = {
    warning: "Reduce overage costs",
    critical: "Maintain full visibility",
    blocked: "Restore observability"
  };

  const statusTone =
    state === "blocked"
      ? "bg-rose-100 text-rose-700"
      : state === "critical"
        ? "bg-rose-100 text-rose-700"
        : state === "warning"
          ? "bg-amber-100 text-amber-800"
          : "bg-emerald-100 text-emerald-700";

  const baseCost = basePlanCosts[plan] ?? null;
  const estimatedUsageCost = usageStatus.estimated_overage_cost ?? 0;
  const totalEstimated =
    baseCost === null ? null : Number.isFinite(baseCost) ? baseCost + estimatedUsageCost : null;

  const shouldPrompt = percentUsed >= 0.7 || isOverLimit;
  const showPressureCard = percentUsed >= 0.8 && isOverLimit;
  const enterpriseTrigger = usageStatus.used >= 100_000_000;

  const targetPlan = useMemo<"team" | "production" | null>(() => {
    const promptPlan = upgradePrompt?.plan;
    if (promptPlan === "team" || promptPlan === "production") return promptPlan;
    if (plan === "free") return "team";
    if (plan === "team") return "production";
    return null;
  }, [plan, upgradePrompt?.plan]);

  async function handleCheckout() {
    if (!targetPlan) return;
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId, plan: targetPlan })
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { checkout_url?: string };
    if (payload.checkout_url) {
      window.location.href = payload.checkout_url;
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <button type="button" className="w-full text-left" onClick={() => setOpen((prev) => !prev)}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-steel">Usage (This Month)</div>
          <div className="text-sm font-semibold text-ink">
            {limit ? `${Math.round(percentUsed * 100)}%` : "Unlimited"}
          </div>
        </div>

        {limit ? (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
            <div
              className={`h-full transition-all duration-500 ease-out ${colors[state]}`}
              style={{ width: `${Math.min(percentUsed * 100, 100)}%` }}
            />
          </div>
        ) : null}

        <div className="mt-2 text-xs text-steel">
          {limit
            ? `${formatNumber(usageStatus.used)} / ${formatNumber(limit)} traces`
            : `${formatNumber(usageStatus.used)} traces`}
        </div>

        {usageStatus.projected_usage && limit ? (
          <div className="mt-2 text-xs text-zinc-500">
            Projected: {formatNumber(projectedUsage)} {isOverLimit ? "⚠" : ""}
          </div>
        ) : null}

        {message[state] ? (
          <div className="mt-3 text-sm text-ink">{message[state]}</div>
        ) : null}

        {shouldPrompt ? (
          <div className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusTone}`}>
            {state}
          </div>
        ) : null}
      </button>

      {enterpriseTrigger ? (
        <Button asChild className="mt-4 w-full" variant="outline">
          <a href="mailto:billing@reliai.dev">Contact sales</a>
        </Button>
      ) : shouldPrompt && targetPlan ? (
        <Button className="mt-4 w-full" onClick={() => setSheetOpen(true)}>
          {cta[state] ?? upgradePrompt?.cta ?? "Upgrade now"}
        </Button>
      ) : null}

      {enterpriseTrigger ? (
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          You’re operating at enterprise scale. Talk to us about dedicated infrastructure and priority ingestion.
        </div>
      ) : showPressureCard ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          At your current rate, you’ll exceed your plan in a few days.
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="text-amber-900 underline decoration-amber-500 underline-offset-2"
            >
              Reduce overage costs and maintain visibility →
            </button>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="mt-4 space-y-4 border-t border-zinc-200 pt-4 text-xs text-steel">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Traces used</span>
              <span className="font-medium text-ink">{formatNumber(usageStatus.used)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Plan limit</span>
              <span className="font-medium text-ink">{limit ? formatNumber(limit) : "No limit"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Projected usage</span>
              <span className="font-medium text-ink">{formatNumber(projectedUsage)}</span>
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
          {!targetPlan ? (
            <Link href="/demo" className="text-xs text-ink underline underline-offset-4">
              Contact sales →
            </Link>
          ) : null}
        </div>
      ) : null}

      {targetPlan && totalEstimated !== null ? (
        <UpgradeSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onConfirm={handleCheckout}
          currentCost={totalEstimated}
          targetPlan={targetPlan}
        />
      ) : null}
    </div>
  );
}
