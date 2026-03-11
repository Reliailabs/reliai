import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PlaygroundScenario, PlaygroundSimulationStage } from "@/hooks/use-playground-simulation";

interface GuardrailRecommendationProps {
  scenario: PlaygroundScenario;
  stage: PlaygroundSimulationStage;
  applied: boolean;
  onApply: () => void;
}

export function GuardrailRecommendation({
  scenario,
  stage,
  applied,
  onApply,
}: GuardrailRecommendationProps) {
  const visible = stage === "guardrail_recommended";

  return (
    <Card className="rounded-[30px] border-zinc-300 p-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-steel" />
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Recommended guardrail</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">
            {visible ? scenario.recommendedGuardrail : "Waiting for root-cause analysis"}
          </h2>
        </div>
      </div>
      <p className="mt-4 text-sm leading-7 text-steel">
        {visible
          ? scenario.recommendationReason
          : "Reliai will recommend a runtime protection once the simulated trace analysis completes."}
      </p>
      <Button type="button" className="mt-6" onClick={onApply} disabled={!visible || applied}>
        {applied ? "Guardrail Applied" : "Apply Guardrail"}
      </Button>
    </Card>
  );
}
