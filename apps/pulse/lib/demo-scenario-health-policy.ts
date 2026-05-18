export type ScenarioHealth = "healthy" | "stale" | "partial" | "unknown";

export type ScenarioHealthPolicy = {
  trust_level: "high" | "degraded" | "low";
  scenario_note: string;
  allow_conclusion: boolean;
};

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
