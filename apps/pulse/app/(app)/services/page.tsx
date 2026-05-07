import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getServicesSurfaceData } from "@/lib/services-data";

export default async function ServicesPage() {
  const servicesData = await getServicesSurfaceData();
  return <DashboardShell initialSection="services" servicesData={servicesData} />;
}
