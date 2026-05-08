import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";

type ReliabilityPatternRead = {
  id: string;
  pattern_type: string;
  model_family: string | null;
  prompt_pattern_hash: string | null;
  failure_type: string;
  failure_probability: number;
  sample_count: number;
  first_seen_at: string;
  last_seen_at: string;
};

export type SystemReliabilityPatternsSurfaceData = {
  items: ReliabilityPatternRead[];
  sourceErrors: string[];
};

export async function getSystemReliabilityPatternsSurfaceData(): Promise<SystemReliabilityPatternsSurfaceData> {
  const token = await getApiAccessToken();
  if (!token) {
    return { items: [], sourceErrors: ["session"] };
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/intelligence/patterns`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return { items: [], sourceErrors: ["reliability-patterns"] };
    }
    const payload = (await response.json()) as { items: ReliabilityPatternRead[] };
    return { items: payload.items ?? [], sourceErrors: [] };
  } catch {
    return { items: [], sourceErrors: ["reliability-patterns"] };
  }
}
