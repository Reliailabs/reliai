import { ControlPanelView } from "@/components/presenters/control-panel-view";
import { demoControlPanel, demoProject } from "@/lib/demoData";

export function ControlPanelPreview() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 bg-[linear-gradient(180deg,#fbfbfc,#f1f3f6)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-rose-400" />
          <span className="h-3 w-3 rounded-full bg-amber-400" />
          <span className="h-3 w-3 rounded-full bg-emerald-400" />
          <span className="ml-3 text-[11px] uppercase tracking-[0.18em] text-steel">Reliai control panel</span>
        </div>
      </div>
      <div className="aspect-video overflow-hidden bg-zinc-100">
        <div className="h-full w-[133.333%] origin-top-left scale-[0.75]">
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
    </div>
  );
}
