import { ArrowRight, BellRing } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PlaygroundScenario, PlaygroundSimulationStage } from "@/hooks/use-playground-simulation";

interface PlaygroundIncidentProps {
  scenario: PlaygroundScenario;
  stage: PlaygroundSimulationStage;
  onViewTrace: () => void;
}

export function PlaygroundIncident({ scenario, stage, onViewTrace }: PlaygroundIncidentProps) {
  const visible = stage === "incident_created" || stage === "trace_analysis" || stage === "guardrail_recommended";

  return (
    <Card className="rounded-[30px] border-zinc-300 p-6">
      <div className="flex items-center gap-3">
        <BellRing className="h-5 w-5 text-secondary" />
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-secondary">Incident preview</p>
          <h2 className="mt-2 text-2xl font-semibold text-primary">{visible ? scenario.incidentTitle : "No incident yet"}</h2>
        </div>
      </div>
      {visible ? (
        <div className="mt-5 space-y-3 text-sm text-secondary">
          <p><span className="font-medium text-primary">model</span> · {scenario.model}</p>
          <p><span className="font-medium text-primary">failure type</span> · {scenario.failureType}</p>
          <p><span className="font-medium text-primary">impact</span> · {scenario.impact}</p>
          <Button type="button" onClick={onViewTrace} className="mt-3">
            View Trace Analysis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ) : (
        <p className="mt-5 text-sm text-secondary">Select a failure scenario to trigger incident creation.</p>
      )}
    </Card>
  );
}
