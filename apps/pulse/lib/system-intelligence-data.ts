import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";

type HighRiskPatternRead = {
  source_node_id: string;
  target_node_id: string;
  relationship_type: string;
  pattern: string;
  risk_level: string;
  confidence: number;
  traces: number;
};

type GuardrailRecommendationRead = {
  policy_type: string;
  title: string;
  description: string;
  confidence: number;
  model_family: string | null;
  recommended_action: string;
};

type GlobalPatternRead = {
  model_family: string;
  issue: string;
  risk_level: string;
  trace_count: number;
  organizations_affected: number;
  confidence: number;
  first_seen: string | null;
};

export type SystemIntelligenceSurfaceData = {
  highRiskPatterns: HighRiskPatternRead[];
  guardrailRecommendations: GuardrailRecommendationRead[];
  globalPatterns: GlobalPatternRead[];
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

export async function getSystemIntelligenceSurfaceData(): Promise<SystemIntelligenceSurfaceData> {
  const token = await getApiAccessToken();
  if (!token) {
    return {
      highRiskPatterns: [],
      guardrailRecommendations: [],
      globalPatterns: [],
      sourceErrors: ["session"],
    };
  }

  const sourceErrors: string[] = [];
  let highRiskPatterns: HighRiskPatternRead[] = [];
  let guardrailRecommendations: GuardrailRecommendationRead[] = [];
  let globalPatterns: GlobalPatternRead[] = [];

  try {
    const res = await fetchJson<{ items: HighRiskPatternRead[] }>(
      `${API_URL}/api/v1/intelligence/high-risk-patterns`,
      token,
    );
    highRiskPatterns = res.items ?? [];
  } catch {
    sourceErrors.push("high-risk-patterns");
  }

  try {
    const res = await fetchJson<{ items: GuardrailRecommendationRead[] }>(
      `${API_URL}/api/v1/intelligence/guardrail-recommendations`,
      token,
    );
    guardrailRecommendations = res.items ?? [];
  } catch {
    sourceErrors.push("guardrail-recommendations");
  }

  try {
    const res = await fetchJson<{ patterns: GlobalPatternRead[] }>(
      `${API_URL}/api/v1/intelligence/global-patterns`,
      token,
    );
    globalPatterns = res.patterns ?? [];
  } catch {
    sourceErrors.push("global-patterns");
  }

  return {
    highRiskPatterns,
    guardrailRecommendations,
    globalPatterns,
    sourceErrors: Array.from(new Set(sourceErrors)),
  };
}
