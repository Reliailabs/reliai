import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";

type PlatformExtensionRead = {
  id: string;
  project_id: string | null;
  name: string;
  processor_type: string;
  version: string;
  event_type: string;
  config_json: Record<string, unknown>;
  health: string;
  event_throughput_per_hour: number;
  recent_failure_count: number;
  last_failure_at: string | null;
};

export type SystemExtensionsSurfaceData = {
  items: PlatformExtensionRead[];
  sourceErrors: string[];
};

export async function getSystemExtensionsSurfaceData(): Promise<SystemExtensionsSurfaceData> {
  const token = await getApiAccessToken();
  if (!token) {
    return { items: [], sourceErrors: ["session"] };
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/system/extensions`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return { items: [], sourceErrors: ["system-extensions"] };
    }
    const payload = (await response.json()) as { items: PlatformExtensionRead[] };
    return { items: payload.items ?? [], sourceErrors: [] };
  } catch {
    return { items: [], sourceErrors: ["system-extensions"] };
  }
}
