import { notFound } from "next/navigation"
import { requireOperatorSession } from "@/lib/auth"
import { getIncidentCommand } from "@/lib/api"
import { IncidentCommandView } from "./incident-command-view"

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ incidentId: string }>
}) {
  await requireOperatorSession()

  const { incidentId } = await params

  const command = await getIncidentCommand(incidentId).catch(() => null)
  if (!command) notFound()

  return <IncidentCommandView incidentId={incidentId} command={command} />
}
