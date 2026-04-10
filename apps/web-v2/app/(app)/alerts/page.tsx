import { getOrganizationAlertDeliveries, getOrganizationAlertTarget } from "@/lib/api"
import { requireOperatorSession } from "@/lib/auth"
import { AlertsView, type AlertTargetData, type AlertDeliveryRow } from "./alerts-view"

export default async function AlertsPage() {
  const session = await requireOperatorSession()
  const orgId = session.active_organization_id ?? session.memberships[0]?.organization_id

  let alertTarget: AlertTargetData | null = null
  let deliveries: AlertDeliveryRow[] = []

  if (orgId) {
    const [target, deliveryData] = await Promise.all([
      getOrganizationAlertTarget(orgId).catch(() => null),
      getOrganizationAlertDeliveries(orgId, { limit: 50 }).catch(() => ({ items: [] })),
    ])

    if (target) {
      alertTarget = {
        channel_type: target.channel_type,
        channel_target: target.channel_target,
        is_active: target.is_active,
        webhook_masked: target.webhook_masked,
      }
    }

    deliveries = deliveryData.items.map((d) => ({
      id: d.id,
      incidentId: d.incident_id,
      channelType: d.channel_type,
      channelTarget: d.channel_target,
      deliveryStatus: d.delivery_status,
      attemptCount: d.attempt_count,
      errorMessage: d.error_message,
      sentAt: d.sent_at,
      createdAt: d.created_at,
    }))
  }

  return <AlertsView alertTarget={alertTarget} deliveries={deliveries} />
}
