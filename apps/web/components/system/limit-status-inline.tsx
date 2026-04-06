"use client";

import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";

import type { LimitStatus } from "@reliai/types";

import { DocsLink } from "@/components/docs/docs-link";
import { cn } from "@/lib/utils";

const standardNumber = new Intl.NumberFormat("en-US");

function formatCount(value: number) {
  return standardNumber.format(value);
}

function windowLabel(window?: LimitStatus["window"]) {
  if (!window) return null;
  const secondsByWindow: Record<NonNullable<LimitStatus["window"]>, number> = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
  };
  const seconds = secondsByWindow[window];
  if (!seconds) return null;
  return `last ${seconds}s`;
}

function renderQuant(limit: LimitStatus) {
  if (typeof limit.metrics?.dropped === "number" && limit.metrics.dropped > 0) {
    const windowText = windowLabel(limit.window);
    return `Dropping ${formatCount(limit.metrics.dropped)} traces/min${windowText ? ` (${windowText})` : ""}`;
  }
  if (typeof limit.metrics?.blocked === "number" && limit.metrics.blocked > 0) {
    return `Blocked ${standardNumber.format(limit.metrics.blocked)} requests in last minute`;
  }
  if (
    typeof limit.metrics?.used === "number" &&
    typeof limit.metrics?.limit === "number" &&
    limit.metrics.limit > 0
  ) {
    const percent =
      typeof limit.metrics?.quota_used_pct === "number"
        ? Math.round(limit.metrics.quota_used_pct * 100)
        : Math.round((limit.metrics.used / limit.metrics.limit) * 100);
    return `${formatCount(limit.metrics.used)} / ${formatCount(limit.metrics.limit)} traces stored (${percent}%)`;
  }
  if (typeof limit.metrics?.quota_used_pct === "number") {
    const percent = Math.round(limit.metrics.quota_used_pct * 100);
    return `Usage: ${percent}%`;
  }
  return null;
}

function filterUpgradeCtas(limit: LimitStatus, cta?: LimitStatus["cta"] | null) {
  if (!cta) return null;
  if (limit.is_plan_related === false && cta.type === "upgrade") return null;
  return cta;
}

function severityTone(severity: LimitStatus["severity"]) {
  if (severity === "critical") return "banner-critical";
  if (severity === "warning") return "banner-warning";
  return "banner-info";
}

function statusIcon(status: LimitStatus["status"]) {
  if (status === "delayed") return Clock;
  return AlertTriangle;
}

export function LimitStatusInline({ limits }: { limits: LimitStatus[] }) {
  if (!limits.length) return null;

  return (
    <div className="space-y-2">
      {limits.map((limit, index) => {
        const Icon = statusIcon(limit.status);
        const showCtas = limit.cta_priority !== "none";
        const primaryCta = showCtas ? filterUpgradeCtas(limit, limit.cta) : null;
        const secondaryCta = showCtas ? filterUpgradeCtas(limit, limit.cta_secondary) : null;
        const quant = renderQuant(limit);
        const isStorage = limit.type === "storage";
        const isApiRate = limit.type === "api_rate";
        return (
          <div
            key={`${limit.type}-${limit.scope?.feature ?? limit.scope?.project_id ?? "global"}-${index}`}
            className={cn("rounded-lg border px-3 py-2 text-xs", severityTone(limit.severity))}
          >
            <div className="flex items-center gap-2 font-medium text-primary">
              <Icon className="h-3.5 w-3.5" />
              <span>{limit.message}</span>
            </div>
            {quant ? (
              <p className="mt-1 text-[11px] text-secondary">
                {quant}
              </p>
            ) : null}
            {isStorage ? (
              <p className="mt-1 text-[11px] text-secondary">
                Retention window may shrink as usage increases
              </p>
            ) : null}
            {isApiRate ? (
              <p className="mt-1 text-[11px] text-secondary">
                Reduce request frequency or retry rate
              </p>
            ) : null}
            {limit.type === "sampling" ? (
              <p className="mt-1 text-[11px] text-secondary">
                Incident evidence may be partial due to sampling.
              </p>
            ) : null}
            <div className="mt-1">
              <DocsLink href="/docs/limits" label="Learn how limits affect data" variant="light" />
            </div>
            {primaryCta || secondaryCta ? (
              <div className="mt-1 text-xs">
                {primaryCta ? (
                  <Link href={{ pathname: primaryCta.href }} className="underline underline-offset-4">
                    {primaryCta.label}
                  </Link>
                ) : null}
                {secondaryCta ? (
                  <>
                    {primaryCta ? <span className="px-1 text-zinc-400">·</span> : null}
                    <Link href={{ pathname: secondaryCta.href }} className="underline underline-offset-4">
                      {secondaryCta.label}
                    </Link>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
