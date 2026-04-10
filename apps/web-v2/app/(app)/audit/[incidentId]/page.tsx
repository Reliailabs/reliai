import { getIncidentEvents } from "@/lib/api"
import { AuditView, type AuditEventRow } from "./audit-view"

export default async function AuditPage({
  params,
}: {
  params: Promise<{ incidentId: string }>
}) {
  const { incidentId } = await params
  const events = await getIncidentEvents(incidentId)

  const rows: AuditEventRow[] = events.items.map((event) => ({
    id: event.id,
    eventType: event.event_type,
    operatorEmail: event.actor_operator_user_email,
    timestamp: event.created_at,
    metadata: event.metadata_json,
  }))

  return <AuditView events={rows} />
}
