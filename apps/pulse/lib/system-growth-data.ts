import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";

type SystemGrowthRead = {
  trace_volume: {
    today: number;
    seven_day_avg: number;
    growth_pct: number;
  };
  incident_metrics: {
    incidents_detected: number;
    avg_mttr_minutes: number;
  };
  guardrail_metrics: {
    retries: number;
    fallbacks: number;
    blocks: number;
  };
  usage_tiers: {
    under_1m: number;
    "1m_10m": number;
    "10m_100m": number;
    "100m_plus": number;
  };
  expansion_metrics: {
    median_expansion_ratio: number;
    top_expansion_ratio: number;
    breakout_accounts_detected: number;
    total_telemetry_30d: number;
  };
};

type SystemCustomerExpansionRead = {
  average_expansion_ratio: number;
  median_expansion_ratio: number;
  top_expansion_ratio: number;
  total_platform_growth_pct: number;
  breakout_customers: number;
};

export type SystemGrowthSurfaceData = {
  growth: SystemGrowthRead | null;
  expansion: SystemCustomerExpansionRead | null;
  sourceErrors: string[];
};

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as T;
}

export async function getSystemGrowthSurfaceData(): Promise<SystemGrowthSurfaceData> {
  const token = await getApiAccessToken();
  if (!token) {
    return { growth: null, expansion: null, sourceErrors: ["session"] };
  }

  const sourceErrors: string[] = [];
  let growth: SystemGrowthRead | null = null;
  let expansion: SystemCustomerExpansionRead | null = null;

  try {
    growth = await fetchJson<SystemGrowthRead>(`${API_URL}/api/v1/system/growth`, token);
  } catch {
    sourceErrors.push("system-growth");
  }

  try {
    expansion = await fetchJson<SystemCustomerExpansionRead>(
      `${API_URL}/api/v1/system/customer-expansion`,
      token,
    );
  } catch {
    sourceErrors.push("system-expansion");
  }

  return { growth, expansion, sourceErrors };
}
