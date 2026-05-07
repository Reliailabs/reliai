import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";

type CustomerExpansionOrganizationRead = {
  organization_id: string;
  organization_name: string;
  first_30_day_volume: number;
  current_30_day_volume: number;
  expansion_ratio: number;
  growth_rate: number;
  breakout: boolean;
};

type SystemCustomerExpansionRead = {
  average_expansion_ratio: number;
  median_expansion_ratio: number;
  top_expansion_ratio: number;
  total_platform_growth_pct: number;
  breakout_customers: number;
  total_telemetry_30d: number;
  organizations: CustomerExpansionOrganizationRead[];
};

export type SystemExpansionSurfaceData = {
  expansion: SystemCustomerExpansionRead | null;
  sourceErrors: string[];
};

export async function getSystemExpansionSurfaceData(): Promise<SystemExpansionSurfaceData> {
  const token = await getApiAccessToken();
  if (!token) {
    return { expansion: null, sourceErrors: ["session"] };
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/system/customer-expansion`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return { expansion: null, sourceErrors: ["system-expansion"] };
    }
    const expansion = (await response.json()) as SystemCustomerExpansionRead;
    return { expansion, sourceErrors: [] };
  } catch {
    return { expansion: null, sourceErrors: ["system-expansion"] };
  }
}
