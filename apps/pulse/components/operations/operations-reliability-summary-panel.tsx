import { buildOperationsReliabilitySummary } from "@/lib/operations-reliability-summary";
import type { OperationsSurfaceData } from "@/components/dashboard/pulse-types";

export function OperationsReliabilitySummaryPanel({
  snapshot,
}: {
  snapshot: OperationsSurfaceData["reliabilitySnapshot"] | undefined;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-3">
      <p className="text-sm text-muted-foreground">
        {buildOperationsReliabilitySummary(snapshot)}
      </p>
    </div>
  );
}
