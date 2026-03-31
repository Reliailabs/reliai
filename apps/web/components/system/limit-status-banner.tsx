"use client";

import { useMemo, useState } from "react";
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

function renderImpact(limit: LimitStatus) {
  if (typeof limit.metrics?.quota_used_pct === "number") {
    const percent = Math.round(limit.metrics.quota_used_pct * 100);
    return `Usage: ${percent}%`;
  }
  return null;
}

export function LimitStatusBanner() {
  const { highestSeverityLimit } = useLimitStatus();
  const [dismissed, setDismissed] = useState(false);

  const limit = useMemo(() => {
    if (dismissed) return null;
    if (!highestSeverityLimit) return null;
    if (highestSeverityLimit.status === "ok") return null;
    return highestSeverityLimit;
  }, [dismissed, highestSeverityLimit]);

  if (!limit) return null;

  const styles = severityStyles(limit.severity);
  const impact = renderImpact(limit);
  const scopeLine = formatScope(limit);
  const showCtas = limit.cta_priority !== "none";
  const primaryCta = showCtas ? limit.cta : null;
  const secondaryCta = showCtas ? limit.cta_secondary : null;

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
              <span>{limit.message}</span>
            </div>
            <div className="mt-1 text-xs text-zinc-600">
              {scopeLine}{impact ? ` · ${impact}` : ""}
            </div>
            {limit.actionable?.primary ? (
              <div className="mt-1 text-xs text-zinc-600">
                {limit.actionable.primary}
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
