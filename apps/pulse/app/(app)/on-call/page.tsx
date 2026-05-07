import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getOncallSurfaceData } from "@/lib/oncall-data";

export default async function OnCallPage() {
  const oncallData = await getOncallSurfaceData();
  return <DashboardShell initialSection="oncall" oncallData={oncallData} />;
}
