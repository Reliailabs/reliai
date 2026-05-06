import { AlertTriangle, ArrowRight, Database, Sparkles, Workflow } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { PlaygroundScenario, PlaygroundSimulationStage } from "@/hooks/use-playground-simulation";
import { cn } from "@/lib/utils";

const nodes = [
  { label: "User Request", icon: Workflow },
  { label: "Retrieval", icon: Database },
  { label: "Prompt Build", icon: Sparkles },
  { label: "LLM Call", icon: AlertTriangle },
  { label: "Guardrail", icon: Sparkles },
];

interface PlaygroundTraceGraphProps {
  scenario: PlaygroundScenario;
  stage: PlaygroundSimulationStage;
}

export function PlaygroundTraceGraph({ scenario, stage }: PlaygroundTraceGraphProps) {
  const visible = stage === "trace_analysis" || stage === "guardrail_recommended";

  return (
    <Card className="rounded-[30px] border-zinc-300 p-6">
      <p className="text-xs uppercase tracking-[0.24em] text-secondary">Trace graph preview</p>
      <h2 className="mt-2 text-2xl font-semibold text-primary">Execution path</h2>
      <div className="mt-6 space-y-3">
        {nodes.map((node, index) => {
          const Icon = node.icon;
          const isFailure = visible && node.label === scenario.traceFailureNode;
          const isGuardrail = visible && node.label === "Guardrail";
          return (
            <div key={node.label} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex min-h-14 flex-1 items-center justify-between rounded-[22px] border px-4 py-3",
                  isFailure && "border-rose-300 bg-rose-50 text-rose-900",
                  !isFailure && isGuardrail && "border-emerald-300 bg-emerald-50 text-emerald-900",
                  !isFailure && !isGuardrail && "border-zinc-200 bg-white text-primary",
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{node.label}</span>
                </div>
                {isFailure ? <span className="text-xs font-semibold uppercase tracking-[0.18em]">failure</span> : null}
                {isGuardrail ? <span className="text-xs font-semibold uppercase tracking-[0.18em]">retry</span> : null}
              </div>
              {index < nodes.length - 1 ? <ArrowRight className="h-4 w-4 text-secondary" /> : null}
            </div>
          );
        })}
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-[22px] border border-zinc-200 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-secondary">Slowest span</p>
          <p className="mt-2 text-sm font-medium text-primary">{visible ? scenario.slowestSpan : "n/a"}</p>
        </div>
        <div className="rounded-[22px] border border-zinc-200 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-secondary">Token-heavy span</p>
          <p className="mt-2 text-sm font-medium text-primary">{visible ? scenario.tokenHeavySpan : "n/a"}</p>
        </div>
        <div className="rounded-[22px] border border-zinc-200 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-secondary">Guardrail retry</p>
          <p className="mt-2 text-sm font-medium text-primary">{visible ? scenario.guardrailRetry : "n/a"}</p>
        </div>
      </div>
    </Card>
  );
}
