export type ReplayHealth = "healthy" | "stale" | "partial" | "unknown";

export type ReplayHealthPolicy = {
  trust_level: "high" | "degraded" | "low";
  evidence_note: string;
  mitigation_note: string;
  allow_conclusion: boolean;
};

export function getReplayHealthPolicy(health: ReplayHealth): ReplayHealthPolicy {
  if (health === "healthy") {
    return {
      trust_level: "high",
      evidence_note: "Evidence chain is complete and replay integrity is verified.",
      mitigation_note: "Mitigation confidence is high for this deterministic replay.",
      allow_conclusion: true,
    };
  }

  if (health === "partial") {
    return {
      trust_level: "degraded",
      evidence_note: "Evidence chain is partial; missing events may change conclusions.",
      mitigation_note: "Mitigation confidence is degraded until evidence gaps are resolved.",
      allow_conclusion: false,
    };
  }

  if (health === "stale") {
    return {
      trust_level: "degraded",
      evidence_note: "Replay snapshot is stale and may not reflect latest mitigation state.",
      mitigation_note: "Mitigation confidence is degraded pending a fresh replay snapshot.",
      allow_conclusion: false,
    };
  }

  return {
    trust_level: "low",
    evidence_note: "Replay outcome is unknown; operational conclusions are not trustworthy.",
    mitigation_note: "Mitigation confidence is low until replay integrity is restored.",
    allow_conclusion: false,
  };
}
