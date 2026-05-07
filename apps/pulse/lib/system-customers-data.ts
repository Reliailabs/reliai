import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";

type CustomerReliabilityProjectRead = {
  project_id: string;
  project_name: string;
  trace_volume_24h: number;
  traces_per_day: number;
  guardrail_rate: number;
  incident_rate: number;
  processor_failures: number;
  processor_failure_rate: number;
  pipeline_lag: number;
  risk_level: string;
};

export type SystemCustomersSurfaceData = {
  projects: CustomerReliabilityProjectRead[];
  sourceErrors: string[];
};

export async function getSystemCustomersSurfaceData(): Promise<SystemCustomersSurfaceData> {
  const token = await getApiAccessToken();
  if (!token) {
    return { projects: [], sourceErrors: ["session"] };
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/system/customers`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return { projects: [], sourceErrors: ["system-customers"] };
    }
    const payload = (await response.json()) as { projects: CustomerReliabilityProjectRead[] };
    return { projects: payload.projects ?? [], sourceErrors: [] };
  } catch {
    return { projects: [], sourceErrors: ["system-customers"] };
  }
}
