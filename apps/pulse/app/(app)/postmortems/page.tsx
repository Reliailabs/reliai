import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getPostmortemsSurfaceData } from "@/lib/postmortems-data";

export default async function PostmortemsPage() {
  const postmortemsData = await getPostmortemsSurfaceData();
  return <DashboardShell initialSection="postmortems" postmortemsData={postmortemsData} />;
}
