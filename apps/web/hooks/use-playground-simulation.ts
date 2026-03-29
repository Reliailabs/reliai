"use client";

import { useEffect, useMemo, useState } from "react";

export type PlaygroundFailureType = "hallucination" | "latency" | "model" | "retrieval";
export type PlaygroundSimulationStage =
  | "idle"
  | "failure_triggered"
  | "incident_created"
  | "trace_analysis"
  | "guardrail_recommended";

export interface PlaygroundScenario {
  id: PlaygroundFailureType;
  label: string;
  incidentTitle: string;
  failureType: string;
  impact: string;
  model: string;
  reliabilityBefore: number;
  reliabilityAfter: number;
  activeIncidents: number;
  guardrailActivity: number;
  deploymentRisk: "LOW" | "MEDIUM" | "HIGH";
  highRiskPattern: string;
  recommendedGuardrail: string;
  recommendationReason: string;
  slowestSpan: string;
  tokenHeavySpan: string;
  guardrailRetry: string;
  traceFailureNode: string;
  failureRateCurrent?: number;
  failureRateBaseline?: number;
  failureRateAfterFix?: number;
}

export const playgroundScenarios: Record<PlaygroundFailureType, PlaygroundScenario> = {
  hallucination: {
    id: "hallucination",
    label: "Hallucination spike",
    incidentTitle: "Hallucination spike detected",
    failureType: "hallucination",
    impact: "19% failure rate",
    model: "gpt-4",
    reliabilityBefore: 92,
    reliabilityAfter: 68,
    failureRateCurrent: 19,
    failureRateBaseline: 4,
    failureRateAfterFix: 5,
    activeIncidents: 1,
    guardrailActivity: 3,
    deploymentRisk: "LOW",
    highRiskPattern: "Hallucination spike",
    recommendedGuardrail: "Enable structured output validation",
    recommendationReason: "Hallucinated responses detected in generation stage.",
    slowestSpan: "llm_call",
    tokenHeavySpan: "llm_call",
    guardrailRetry: "structured_output retry",
    traceFailureNode: "LLM Call",
  },
  latency: {
    id: "latency",
    label: "Latency regression",
    incidentTitle: "Latency regression detected",
    failureType: "latency",
    impact: "P95 latency increased 41%",
    model: "gpt-4.1-mini",
    reliabilityBefore: 91,
    reliabilityAfter: 63,
    activeIncidents: 1,
    guardrailActivity: 4,
    deploymentRisk: "MEDIUM",
    highRiskPattern: "Latency regression in retrieval stage",
    recommendedGuardrail: "Enable latency retry policy",
    recommendationReason: "Retrieval latency crossed the regression threshold.",
    slowestSpan: "retrieval",
    tokenHeavySpan: "prompt_build",
    guardrailRetry: "latency_retry",
    traceFailureNode: "Retrieval",
  },
  model: {
    id: "model",
    label: "Model regression",
    incidentTitle: "Model quality regression detected",
    failureType: "model_regression",
    impact: "18% lower answer quality",
    model: "gpt-4.1",
    reliabilityBefore: 90,
    reliabilityAfter: 61,
    activeIncidents: 1,
    guardrailActivity: 2,
    deploymentRisk: "HIGH",
    highRiskPattern: "Model regression after route change",
    recommendedGuardrail: "Enable model fallback guardrail",
    recommendationReason: "Quality failure concentrated after the new model route was deployed.",
    slowestSpan: "llm_call",
    tokenHeavySpan: "llm_call",
    guardrailRetry: "fallback_model",
    traceFailureNode: "LLM Call",
  },
  retrieval: {
    id: "retrieval",
    label: "Retrieval failure",
    incidentTitle: "Retrieval failure detected",
    failureType: "retrieval_failure",
    impact: "17% missing context responses",
    model: "gpt-4.1-mini",
    reliabilityBefore: 93,
    reliabilityAfter: 66,
    activeIncidents: 1,
    guardrailActivity: 3,
    deploymentRisk: "MEDIUM",
    highRiskPattern: "Retrieval failure concentration",
    recommendedGuardrail: "Enable retrieval retry guardrail",
    recommendationReason: "Context fetch failures are causing unsupported answers.",
    slowestSpan: "retrieval",
    tokenHeavySpan: "prompt_build",
    guardrailRetry: "retrieval_retry",
    traceFailureNode: "Retrieval",
  },
};

interface UsePlaygroundSimulationOptions {
  initialFailure?: PlaygroundFailureType;
  disableAnimation?: boolean;
}

export function usePlaygroundSimulation(options: UsePlaygroundSimulationOptions = {}) {
  const {
    initialFailure = "hallucination",
    disableAnimation = false,
  } = options;
  const [selectedFailure, setSelectedFailure] = useState<PlaygroundFailureType>(initialFailure);
  const [simulationStage, setSimulationStage] = useState<PlaygroundSimulationStage>(
    disableAnimation ? "guardrail_recommended" : "idle",
  );
  const [guardrailApplied, setGuardrailApplied] = useState(disableAnimation);

  useEffect(() => {
    const scenario = playgroundScenarios[selectedFailure];
    if (!scenario) return;

    setGuardrailApplied(false);
    if (disableAnimation) {
      setSimulationStage("guardrail_recommended");
      return;
    }

    setSimulationStage("failure_triggered");
    const incidentTimer = window.setTimeout(() => setSimulationStage("incident_created"), 450);
    const traceTimer = window.setTimeout(() => setSimulationStage("trace_analysis"), 950);
    const guardrailTimer = window.setTimeout(
      () => setSimulationStage("guardrail_recommended"),
      1450,
    );

    return () => {
      window.clearTimeout(incidentTimer);
      window.clearTimeout(traceTimer);
      window.clearTimeout(guardrailTimer);
    };
  }, [disableAnimation, selectedFailure]);

  const scenario = useMemo(() => playgroundScenarios[selectedFailure], [selectedFailure]);

  return {
    selectedFailure,
    setSelectedFailure,
    simulationStage,
    scenario,
    guardrailApplied,
    applyGuardrail: () => setGuardrailApplied(true),
  };
}
