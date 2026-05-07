import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";

type PlatformMetricsRead = {
  trace_ingest_rate: number;
  pipeline_latency: number | null;
  processor_failure_rate: number;
  warehouse_lag: number;
  warehouse_rows: number;
  active_partitions: number;
  scan_rate: number;
  avg_query_latency: number;
  archive_backlog: number;
  customer_overload_risk: string;
};

export type SystemPlatformSurfaceData = {
  metrics: PlatformMetricsRead | null;
  sourceErrors: string[];
};

export async function getSystemPlatformSurfaceData(): Promise<SystemPlatformSurfaceData> {
  const token = await getApiAccessToken();
  if (!token) {
    return { metrics: null, sourceErrors: ["session"] };
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/system/platform`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return { metrics: null, sourceErrors: ["system-platform"] };
    }
    const metrics = (await response.json()) as PlatformMetricsRead;
    return { metrics, sourceErrors: [] };
  } catch {
    return { metrics: null, sourceErrors: ["system-platform"] };
  }
}
