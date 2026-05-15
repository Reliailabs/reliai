import type { OperationsSurfaceData } from "@/components/dashboard/pulse-types";

export function buildOperationsReliabilitySummary(
  snapshot: OperationsSurfaceData["reliabilitySnapshot"],
): string {
  return `Reliability snapshot: ${snapshot.reliability_score} score · ${snapshot.verified_count} verified · ${snapshot.failed_count} failed · ${snapshot.rolled_back_count} rolled back`;
}
