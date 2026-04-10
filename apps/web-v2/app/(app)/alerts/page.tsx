import { getOrganizationAlertTarget } from "@/lib/api"
import { requireOperatorSession } from "@/lib/auth"
import { AlertsView, type AlertTargetData } from "./alerts-view"

export default async function AlertsPage() {
  const session = await requireOperatorSession()
  const orgId = session.active_organization_id ?? session.memberships[0]?.organization_id

  let alertTarget: AlertTargetData | null = null
  if (orgId) {
    const target = await getOrganizationAlertTarget(orgId)
    alertTarget = {
      channel_type: target.channel_type,
      channel_target: target.channel_target,
      is_active: target.is_active,
      webhook_masked: target.webhook_masked,
    }
  }

  return <AlertsView alertTarget={alertTarget} />
}
