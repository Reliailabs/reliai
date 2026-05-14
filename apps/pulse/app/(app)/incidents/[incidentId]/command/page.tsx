import { redirect } from "next/navigation";

export default async function IncidentCommandCompatPage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  redirect(`/incidents/${incidentId}`);
}
