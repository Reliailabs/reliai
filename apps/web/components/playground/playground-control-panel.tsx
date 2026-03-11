import type { ProjectReliabilityControlPanel } from "@reliai/types";

import { ControlPanelView } from "@/components/presenters/control-panel-view";
import type { PlaygroundScenario, PlaygroundSimulationStage } from "@/hooks/use-playground-simulation";
import { demoProject } from "@/lib/demoData";

function buildPanel(scenario: PlaygroundScenario, stage: PlaygroundSimulationStage): ProjectReliabilityControlPanel {
  const reliabilityScore =
    stage === "idle" ? scenario.reliabilityBefore : scenario.reliabilityAfter;
  const activeIncidents = stage === "idle" ? 0 : scenario.activeIncidents;
  const guardrailActivity = stage === "idle" ? 0 : scenario.guardrailActivity;
  const recommendedGuardrails =
    stage === "guardrail_recommended"
      ? [
          {
            policy_type: scenario.failureType,
            recommended_action: scenario.recommendedGuardrail,
            title: scenario.recommendedGuardrail,
            confidence: 0.92,
            model_family: scenario.model,
          },
        ]
      : [];

  return {
    reliability_score: reliabilityScore,
    active_incidents: activeIncidents,
    deployment_risk: {
      latest_deployment_id: "dep_playground",
      deployed_at: "2026-03-11T09:00:00Z",
      risk_score: scenario.deploymentRisk === "HIGH" ? 0.82 : scenario.deploymentRisk === "MEDIUM" ? 0.55 : 0.24,
      risk_level: scenario.deploymentRisk.toLowerCase(),
    },
    simulation: {
      latest_simulation_id: "sim_playground",
      predicted_failure_rate: 0.18,
      predicted_latency: 1420,
      risk_level: scenario.deploymentRisk === "HIGH" ? "high" : scenario.deploymentRisk === "MEDIUM" ? "medium" : "low",
      created_at: "2026-03-11T08:45:00Z",
    },
    incidents: {
      recent_incidents:
        activeIncidents > 0
          ? [
              {
                incident_id: "inc_playground",
                title: scenario.incidentTitle,
                severity: "high",
                status: "open",
                started_at: "2026-03-11T10:22:00Z",
              },
            ]
          : [],
      incident_rate_last_24h: activeIncidents,
    },
    guardrails: {
      trigger_rate_last_24h: guardrailActivity,
      top_triggered_policy: activeIncidents > 0 ? scenario.recommendedGuardrail.toLowerCase().replaceAll(" ", "_") : null,
    },
    guardrail_activity:
      guardrailActivity > 0
        ? [
            {
              policy_type: scenario.recommendedGuardrail.toLowerCase().replaceAll(" ", "_"),
              trigger_count: guardrailActivity,
            },
          ]
        : [],
    guardrail_compliance: [
      {
        policy_type: "structured_output",
        enforcement_mode: "enforce",
        coverage_pct: 98,
        violation_count: activeIncidents > 0 ? 4 : 0,
      },
    ],
    model_reliability: {
      current_model: scenario.model,
      success_rate: activeIncidents > 0 ? 0.83 : 0.98,
      average_latency: scenario.slowestSpan === "retrieval" ? 1420 : 1180,
      structured_output_validity: scenario.id === "hallucination" ? 0.72 : 0.97,
    },
    high_risk_patterns:
      activeIncidents > 0
        ? [
            {
              pattern: scenario.highRiskPattern,
              risk_level: "high",
              trace_count: 143,
              confidence: 0.88,
            },
          ]
        : [],
    graph_high_risk_patterns: [],
    recommended_guardrails: recommendedGuardrails,
    model_failure_signals: [],
    recent_deployments: [
      {
        deployment_id: "dep_playground",
        deployed_at: "2026-03-11T09:00:00Z",
        environment: "production",
        risk_level: scenario.deploymentRisk.toLowerCase(),
        risk_score: scenario.deploymentRisk === "HIGH" ? 0.82 : scenario.deploymentRisk === "MEDIUM" ? 0.55 : 0.24,
      },
    ],
    automatic_actions: {
      recent_actions: [],
    },
  };
}

interface PlaygroundControlPanelProps {
  scenario: PlaygroundScenario;
  stage: PlaygroundSimulationStage;
  screenshotMode?: boolean;
}

export function PlaygroundControlPanel({
  scenario,
  stage,
  screenshotMode = false,
}: PlaygroundControlPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Simulated control panel</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">System health under failure</h2>
        </div>
        <div className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-800">
          Reliability {scenario.reliabilityBefore} → {stage === "idle" ? scenario.reliabilityBefore : scenario.reliabilityAfter}
        </div>
      </div>
      <ControlPanelView
        projectId={demoProject.id}
        projectName={demoProject.name}
        environment={demoProject.environment}
        panel={buildPanel(scenario, stage)}
        screenshotMode
        screenshotWidth={screenshotMode ? 1400 : 1600}
        highlightedMetrics={["reliability_score", "active_incidents", "recommended_guardrail"]}
      />
    </div>
  );
}
