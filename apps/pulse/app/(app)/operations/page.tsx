import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getOperationsSurfaceData } from "@/lib/operations-timeline";

export default async function OperationsPage() {
  const operationsData = await getOperationsSurfaceData();
  return (
    <DashboardShell
      initialSection="operations"
      operationsData={operationsData}
    />
  );
}
