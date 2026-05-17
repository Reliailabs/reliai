export type DemoScenarioIncident = {
  id: string;
  title: string;
  severity: "high" | "critical";
  status: "investigating" | "mitigated";
  created_at: string;
};

export type DemoScenarioTrace = {
  id: string;
  model: string;
  outcome: "policy_violation" | "regression";
  started_at: string;
};

export type DemoScenarioReliability = {
  before_score: number;
  after_score: number;
  verification_pass_rate: number;
};

export type DemoScenarioFixture = {
  scenario_id: string;
  incident: DemoScenarioIncident;
  trace: DemoScenarioTrace;
  reliability: DemoScenarioReliability;
  timeline: ReadonlyArray<{
    id: string;
    step: string;
    at: string;
  }>;
};

const FIXTURE: DemoScenarioFixture = {
  scenario_id: "demo-inc-refund-policy-001",
  incident: {
    id: "inc-demo-001",
    title: "Agent approved refund outside policy guardrail",
    severity: "high",
    status: "investigating",
    created_at: "2026-05-12T09:14:00.000Z",
  },
  trace: {
    id: "trace-demo-001",
    model: "gpt-4.1",
    outcome: "policy_violation",
    started_at: "2026-05-12T09:12:13.000Z",
  },
  reliability: {
    before_score: 62,
    after_score: 79,
    verification_pass_rate: 0.83,
  },
  timeline: [
    {
      id: "evt-demo-001",
      step: "Violation detected from production trace",
      at: "2026-05-12T09:14:00.000Z",
    },
    {
      id: "evt-demo-002",
      step: "Operator review opened with evidence chain",
      at: "2026-05-12T09:16:30.000Z",
    },
    {
      id: "evt-demo-003",
      step: "Mitigation policy staged and verified",
      at: "2026-05-12T09:28:10.000Z",
    },
  ],
};

export function getDemoScenarioFixture(): DemoScenarioFixture {
  return FIXTURE;
}
