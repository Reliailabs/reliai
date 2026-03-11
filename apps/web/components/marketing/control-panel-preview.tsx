import { ControlPanelView } from "@/components/presenters/control-panel-view";
import { demoControlPanel, demoProject } from "@/lib/demoData";

export function ControlPanelPreview() {
  return (
    <div className="overflow-hidden rounded-[34px] border border-zinc-300 bg-white p-3 shadow-[0_28px_80px_rgba(15,23,42,0.10)]">
      <div className="overflow-hidden rounded-[26px] border border-zinc-200 bg-zinc-100">
        <ControlPanelView
          projectId={demoProject.id}
          projectName={demoProject.name}
          environment={demoProject.environment}
          panel={demoControlPanel}
          screenshotMode
          screenshotWidth={1200}
          highlightedMetrics={["reliability_score", "active_incidents", "recommended_guardrail"]}
        />
      </div>
    </div>
  );
}
