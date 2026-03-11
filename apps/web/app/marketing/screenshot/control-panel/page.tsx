import { ControlPanelView } from "@/components/presenters/control-panel-view";
import { demoControlPanel, demoProject } from "@/lib/demoData";

export default function MarketingControlPanelScreenshotPage() {
  return (
    <ControlPanelView
      projectId={demoProject.id}
      projectName={demoProject.name}
      environment={demoProject.environment}
      panel={demoControlPanel}
      screenshotMode
    />
  );
}
