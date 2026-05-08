import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getErrorsSurfaceData } from "@/lib/errors-data";

export default async function ErrorsPage() {
  const errorsData = await getErrorsSurfaceData();
  return <DashboardShell initialSection="errors" errorsData={errorsData} />;
}
