import type { OperationsSurfaceData } from "@/components/dashboard/pulse-types";

export function buildOperationsReliabilitySummary(
  snapshot: OperationsSurfaceData["reliabilitySnapshot"] | null | undefined,
  now: Date = new Date(),
): string {
  if (!snapshot) {
    return "Reliability snapshot unavailable.";
  }

  const hasInvalidNumbers =
    !Number.isFinite(snapshot.reliability_score) ||
    !Number.isFinite(snapshot.verified_count) ||
    !Number.isFinite(snapshot.failed_count) ||
    !Number.isFinite(snapshot.rolled_back_count);
  if (hasInvalidNumbers) {
    return "Reliability snapshot unavailable.";
  }

  const capturedAt = new Date(snapshot.captured_at);
  const isStale =
    Number.isFinite(capturedAt.getTime()) &&
    now.getTime() - capturedAt.getTime() > 24 * 60 * 60 * 1000;
  const staleSuffix = isStale ? " (stale)" : "";

  return `Reliability snapshot${staleSuffix}: ${snapshot.reliability_score} score · ${snapshot.verified_count} verified · ${snapshot.failed_count} failed · ${snapshot.rolled_back_count} rolled back`;
}
