"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { LimitStatus } from "@reliai/types";

const SEVERITY_ORDER: Record<string, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

function sortBySeverity(items: LimitStatus[]) {
  return [...items].sort(
    (a, b) => (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0)
  );
}

export function useLimitStatus(projectId?: string) {
  const [limits, setLimits] = useState<LimitStatus[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const fetchLimits = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (projectId) params.set("project_id", projectId);
      const query = params.size ? `?${params.toString()}` : "";
      const response = await fetch(`/api/system/limits${query}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to load limits: ${response.status}`);
      }
      const payload = (await response.json()) as { limits?: LimitStatus[] };
      setLimits(Array.isArray(payload.limits) ? payload.limits : []);
      setError(null);
    } catch (err) {
      setError(err as Error);
    }
  }, [projectId]);

  useEffect(() => {
    fetchLimits();
    const interval = setInterval(fetchLimits, 30000);
    return () => clearInterval(interval);
  }, [fetchLimits]);

  const highestSeverityLimit = useMemo(() => {
    if (!limits.length) return null;
    return sortBySeverity(limits)[0] ?? null;
  }, [limits]);

  const byType = useMemo(() => {
    return limits.reduce<Record<string, LimitStatus[]>>((acc, item) => {
      acc[item.type] = acc[item.type] ? [...acc[item.type], item] : [item];
      return acc;
    }, {});
  }, [limits]);

  const byFeature = useMemo(() => {
    return limits.reduce<Record<string, LimitStatus[]>>((acc, item) => {
      const feature = item.scope?.feature;
      if (!feature) return acc;
      acc[feature] = acc[feature] ? [...acc[feature], item] : [item];
      return acc;
    }, {});
  }, [limits]);

  const byScope = useMemo(() => {
    return limits.reduce<Record<string, LimitStatus[]>>((acc, item) => {
      const level = item.scope?.level ?? "global";
      acc[level] = acc[level] ? [...acc[level], item] : [item];
      return acc;
    }, {});
  }, [limits]);

  return {
    limits,
    highestSeverityLimit,
    byType,
    byFeature,
    byScope,
    error,
    refresh: fetchLimits,
  };
}
