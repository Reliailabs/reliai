import type { DeploymentDetailRead } from "@reliai/types";

import { DeploymentDetailView } from "@/components/presenters/deployment-detail-view";
import { getDeploymentDetail } from "@/lib/api";

export default async function DeploymentDetailPage({
  params,
}: {
  params: Promise<{ deploymentId: string }>;
}) {
  const { deploymentId } = await params;
  const detail: DeploymentDetailRead = await getDeploymentDetail(deploymentId);

  return <DeploymentDetailView detail={detail} />;
}
