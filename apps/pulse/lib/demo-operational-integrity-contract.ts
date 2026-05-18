import type { DemoScenarioFixture } from "./demo-scenario-fixtures";

export type ReplayHealth = "healthy" | "stale" | "partial" | "unknown";
export type ScenarioHealth = "healthy" | "stale" | "partial" | "unknown";

export type ReplayHealthPolicy = {
  trust_level: "high" | "degraded" | "low";
  evidence_note: string;
  mitigation_note: string;
  allow_conclusion: boolean;
};

export type ScenarioHealthPolicy = {
  trust_level: "high" | "degraded" | "low";
  scenario_note: string;
  allow_conclusion: boolean;
};

export type MitigationConclusionDecision = {
  allowed: boolean;
  block_reason:
    | "none"
    | "replay_not_complete"
    | "replay_health_not_trustworthy"
    | "scenario_health_not_trustworthy"
    | "both_health_dimensions_not_trustworthy";
};

export function getMitigationOutcomeMessage(decision: MitigationConclusionDecision): string {
  if (decision.allowed) {
    return "Mitigation outcome available.";
  }
  return "Mitigation confidence pending replay integrity.";
}

export function getOperationalConclusionBlockMessage(
  decision: MitigationConclusionDecision,
): string | null {
  if (decision.allowed || decision.block_reason === "none") {
    return null;
  }

  if (decision.block_reason === "replay_not_complete") {
    return "replay not complete";
  }
  if (decision.block_reason === "replay_health_not_trustworthy") {
    return "replay health not trustworthy";
  }
  if (decision.block_reason === "scenario_health_not_trustworthy") {
    return "scenario health not trustworthy";
  }
  return "both replay and scenario health are not trustworthy";
}

export function deriveReplayHealth(profile: DemoScenarioFixture["replay_profile"]): ReplayHealth {
  if (profile.unknown_outcome) {
    return "unknown";
  }
  if (profile.partial) {
    return "partial";
  }
  if (profile.stale) {
    return "stale";
  }
  return "healthy";
}

export function deriveScenarioHealth(
  profile: DemoScenarioFixture["scenario_profile"],
): ScenarioHealth {
  if (profile.unknown_outcome) {
    return "unknown";
  }
  if (profile.partial_evidence) {
    return "partial";
  }
  if (profile.stale_mitigation) {
    return "stale";
  }
  return "healthy";
}

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

export function getScenarioHealthPolicy(health: ScenarioHealth): ScenarioHealthPolicy {
  if (health === "healthy") {
    return {
      trust_level: "high",
      scenario_note: "Scenario state is current and evidence-backed.",
      allow_conclusion: true,
    };
  }

  if (health === "partial") {
    return {
      trust_level: "degraded",
      scenario_note: "Scenario evidence is partial; outcome confidence is reduced.",
      allow_conclusion: false,
    };
  }

  if (health === "stale") {
    return {
      trust_level: "degraded",
      scenario_note: "Scenario mitigation state is stale and may lag the latest incident response.",
      allow_conclusion: false,
    };
  }

  return {
    trust_level: "low",
    scenario_note: "Scenario outcome is unknown and should not be treated as operationally conclusive.",
    allow_conclusion: false,
  };
}

export function canConcludeMitigation(
  replayDone: boolean,
  replayHealth: ReplayHealth,
  scenarioHealth: ScenarioHealth,
): boolean {
  return getMitigationConclusionDecision(replayDone, replayHealth, scenarioHealth).allowed;
}

export function getMitigationConclusionDecision(
  replayDone: boolean,
  replayHealth: ReplayHealth,
  scenarioHealth: ScenarioHealth,
): MitigationConclusionDecision {
  if (!replayDone) {
    return { allowed: false, block_reason: "replay_not_complete" };
  }

  const replayAllowed = getReplayHealthPolicy(replayHealth).allow_conclusion;
  const scenarioAllowed = getScenarioHealthPolicy(scenarioHealth).allow_conclusion;

  if (replayAllowed && scenarioAllowed) {
    return { allowed: true, block_reason: "none" };
  }
  if (!replayAllowed && !scenarioAllowed) {
    return { allowed: false, block_reason: "both_health_dimensions_not_trustworthy" };
  }
  if (!replayAllowed) {
    return { allowed: false, block_reason: "replay_health_not_trustworthy" };
  }
  return { allowed: false, block_reason: "scenario_health_not_trustworthy" };
}
