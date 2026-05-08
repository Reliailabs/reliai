import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireOperatorSession } from "@/lib/auth";
import { getSettingsSurfaceData } from "@/lib/settings-data";

export default async function SettingsPage() {
  const session = await requireOperatorSession("/settings");
  const organizationId =
    session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
  const settingsData = await getSettingsSurfaceData(organizationId);
  return <DashboardShell initialSection="settings" settingsData={settingsData} />;
}
