"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import type { LimitStatus } from "@reliai/types";

import { Button } from "@/components/ui/button";
import { useLimitStatus } from "@/hooks/use-limit-status";
import { cn } from "@/lib/utils";

function severityStyles(severity: LimitStatus["severity"]) {
  if (severity === "critical") {
    return {
      wrapper: "border-red-200 bg-red-50 text-red-900",
      badge: "bg-red-100 text-red-700",
    };
  }
  if (severity === "warning") {
    return {
      wrapper: "border-amber-200 bg-amber-50 text-amber-900",
      badge: "bg-amber-100 text-amber-700",
    };
  }
  return {
    wrapper: "border-zinc-200 bg-white text-ink",
    badge: "bg-zinc-100 text-zinc-600",
  };
}

function formatScope(limit: LimitStatus) {
  const scope = limit.scope;
  if (!scope) return "Scope: global";
  if (scope.level === "project" && scope.project_id) return `Project: ${scope.project_id}`;
  if (scope.level === "ai_feature" && scope.feature) return `Feature: ${scope.feature.replaceAll("_", " ")}`;
  if (scope.level === "incident" && scope.incident_id) return `Incident: ${scope.incident_id}`;
  if (scope.level === "trace" && scope.trace_id) return `Trace: ${scope.trace_id}`;
  return `Scope: ${scope.level}`;
}

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

function otherLimitLabel(type: LimitStatus["type"]) {
  if (type === "ingest_global" || type === "ingest_project") return "INGEST";
  if (type === "api_rate") return "API";
  if (type === "sampling") return "SAMPLING";
  if (type === "storage") return "STORAGE";
  if (type === "processor_dispatch") return "PROCESSING";
  if (type === "queue_lag") return "QUEUE";
  if (type === "llm_provider") return "AI";
  if (type === "payload_truncation") return "PAYLOAD";
  return "LIMIT";
}

function recoveryMessageFor(limit: LimitStatus) {
  const windowText = windowLabel(limit.window) ?? "last 60s";
  if (limit.type === "ingest_global" || limit.type === "ingest_project") {
    return `Ingest rate normalized — no traces dropped in ${windowText}`;
  }
  if (limit.type === "api_rate") {
    return `API rate normalized — no requests blocked in ${windowText}`;
  }
  return null;
}

export function LimitStatusBanner() {
  const { limits } = useLimitStatus();
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousActive = useRef<Record<string, LimitStatus>>({});

  const { limit, otherLimits } = useMemo(() => {
    if (dismissed) return { limit: null, otherLimits: [] };
    const activeLimits = limits.filter((item) => item.status !== "ok");
    if (!activeLimits.length) return { limit: null, otherLimits: [] };
    const sorted = [...activeLimits].sort((a, b) => {
      const rank = { critical: 3, warning: 2, info: 1 };
      return (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0);
    });
    return {
      limit: sorted[0],
      otherLimits: sorted.slice(1),
    };
  }, [dismissed, limits]);

  useEffect(() => {
    const actionableTypes = new Set(["ingest_global", "ingest_project", "api_rate"]);
    const currentActive: Record<string, LimitStatus> = {};
    limits.forEach((item) => {
      if (item.status !== "ok" && actionableTypes.has(item.type)) {
        currentActive[item.type] = item;
      }
    });
    const clearedTypes = Object.keys(previousActive.current).filter(
      (type) => !(type in currentActive)
    );
    if (clearedTypes.length) {
      const prioritized = ["ingest_global", "ingest_project", "api_rate"].find((type) =>
        clearedTypes.includes(type)
      );
      const cleared = prioritized ? previousActive.current[prioritized] : previousActive.current[clearedTypes[0]];
      const message = cleared ? recoveryMessageFor(cleared) : null;
      if (message) {
        setRecoveryMessage(message);
        if (recoveryTimer.current) {
          clearTimeout(recoveryTimer.current);
        }
        recoveryTimer.current = setTimeout(() => {
          setRecoveryMessage(null);
        }, 120000);
      }
    }
    previousActive.current = currentActive;
  }, [limits]);

  useEffect(() => {
    return () => {
      if (recoveryTimer.current) {
        clearTimeout(recoveryTimer.current);
        recoveryTimer.current = null;
      }
    };
  }, []);

  if (!limit && !recoveryMessage) return null;

  if (!limit && recoveryMessage) {
    const styles = severityStyles("info");
    return (
      <div className={cn("mb-4 rounded-xl border px-4 py-3", styles.wrapper)}>
        <div className="flex items-start gap-3">
          <div className={cn("mt-0.5 rounded-full px-2 py-1 text-xs font-semibold uppercase", styles.badge)}>
            Recovery
          </div>
          <div className="text-sm font-semibold">{recoveryMessage}</div>
        </div>
      </div>
    );
  }

  const styles = severityStyles(limit!.severity);
  const impact = renderQuant(limit!);
  const scopeLine = formatScope(limit!);
  const showCtas = limit!.cta_priority !== "none";
  const primaryCta = showCtas ? filterUpgradeCtas(limit!, limit!.cta) : null;
  const secondaryCta = showCtas ? filterUpgradeCtas(limit!, limit!.cta_secondary) : null;
  const remainingCount = otherLimits?.length ?? 0;
  const isStorage = limit!.type === "storage";
  const isApiRate = limit!.type === "api_rate";

  return (
    <div className={cn("mb-4 rounded-xl border px-4 py-3", styles.wrapper)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-[240px] flex-1 items-start gap-3">
          <div className={cn("mt-0.5 rounded-full px-2 py-1 text-xs font-semibold uppercase", styles.badge)}>
            Limit
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" />
              <span>{limit!.message}</span>
            </div>
            <div className="mt-1 text-xs text-zinc-600">
              {scopeLine}{impact ? ` · ${impact}` : ""}
            </div>
            {isStorage ? (
              <div className="mt-1 text-xs text-zinc-600">
                Retention window may shrink as usage increases
              </div>
            ) : null}
            {isApiRate ? (
              <div className="mt-1 text-xs text-zinc-600">
                Reduce request frequency or retry rate
              </div>
            ) : null}
            {limit!.actionable?.primary ? (
              <div className="mt-1 text-xs text-zinc-600">
                {limit!.actionable.primary}
              </div>
            ) : null}
            {remainingCount > 0 ? (
              <button
                type="button"
                className="mt-2 text-xs font-medium text-zinc-700 hover:text-zinc-900"
                onClick={() => setExpanded((prev) => !prev)}
              >
                {expanded ? "Hide other limits" : `+${remainingCount} other limits active`}
              </button>
            ) : null}
            {expanded && remainingCount > 0 ? (
              <div className="mt-2 space-y-2">
                {otherLimits?.map((item, index) => {
                  const itemCta = item.cta_priority === "none" ? null : filterUpgradeCtas(item, item.cta);
                  return (
                    <div
                      key={`${item.type}-${item.scope?.project_id ?? item.scope?.feature ?? "global"}-${index}`}
                      className="rounded-lg border border-zinc-200 bg-white/60 px-2 py-2 text-xs text-zinc-700"
                    >
                      <div className="font-medium">[{otherLimitLabel(item.type)}] {item.message}</div>
                      {itemCta ? (
                        <div className="mt-1">
                          <Link href={{ pathname: itemCta.href }} className="underline underline-offset-4">
                            {itemCta.label}
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {primaryCta ? (
            <Button asChild size="sm" variant="outline">
              <Link href={{ pathname: primaryCta.href }}>{primaryCta.label}</Link>
            </Button>
          ) : null}
          {secondaryCta ? (
            <Button asChild size="sm" variant="subtle">
              <Link href={{ pathname: secondaryCta.href }}>{secondaryCta.label}</Link>
            </Button>
          ) : null}
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-zinc-700"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss limit banner"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
