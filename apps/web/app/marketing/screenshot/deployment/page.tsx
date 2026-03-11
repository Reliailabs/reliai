import { DeploymentDetailView } from "@/components/presenters/deployment-detail-view";
import { demoDeploymentDetail } from "@/lib/demoData";

export default function MarketingDeploymentScreenshotPage() {
  return <DeploymentDetailView detail={demoDeploymentDetail} screenshotMode />;
}
