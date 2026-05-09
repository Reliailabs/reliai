export type OperatorConfidence = "insufficient" | "low" | "medium" | "high";

export const OPERATOR_INTELLIGENCE_COPY = {
  observedContributingFactors: "Observed contributing factors",
  relatedOperationalSignals: "Related operational signals",
  evidenceReferences: "Evidence references",
  requiresOperatorReview: "Requires operator review",
  insufficientEvidence: "Insufficient linked evidence in current snapshot.",
} as const;

export function formatConfidenceLabel(confidence: OperatorConfidence): string {
  return confidence === "insufficient" ? "insufficient data" : `${confidence} confidence`;
}

export function confidenceFromEvidenceCount(evidenceCount: number): OperatorConfidence {
  if (evidenceCount <= 0) return "insufficient";
  if (evidenceCount >= 4) return "high";
  if (evidenceCount >= 2) return "medium";
  return "low";
}
