"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { DemoConversionCard } from "@/components/demo/demo-conversion-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  usePlaygroundSimulation,
  type PlaygroundFailureType,
} from "@/hooks/use-playground-simulation";

import { FailureSelector } from "./failure-selector";
import { GuardrailRecommendation } from "./guardrail-recommendation";
import { PlaygroundControlPanel } from "./playground-control-panel";
import { PlaygroundIncident } from "./playground-incident";
import { PlaygroundTraceGraph } from "./playground-trace-graph";

interface PlaygroundExperienceProps {
  screenshotMode?: boolean;
  initialFailure?: PlaygroundFailureType;
}

export function PlaygroundExperience({
  screenshotMode = false,
  initialFailure = "hallucination",
}: PlaygroundExperienceProps) {
  const {
    selectedFailure,
    setSelectedFailure,
    simulationStage,
    scenario,
    guardrailApplied,
    applyGuardrail,
  } = usePlaygroundSimulation({
    initialFailure,
    disableAnimation: screenshotMode,
  });

  const traceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (simulationStage === "trace_analysis") {
      traceRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [simulationStage]);

  return (
    <main className="bg-[#f7f8fa]">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10">
          {!screenshotMode ? (
            <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.55fr)]">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-steel">Interactive playground</p>
                <h1 className="mt-4 text-5xl font-semibold tracking-tight text-ink">
                  Simulate AI failures in production
                </h1>
                <p className="mt-5 max-w-3xl text-lg leading-8 text-steel">
                  See how Reliai detects regressions, opens incidents, and recommends guardrails before users notice.
                </p>
              </div>
              <Card className="rounded-[30px] border-zinc-300 p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Product loop</p>
                <p className="mt-4 text-sm leading-7 text-steel">
                  trace → detect regression → open incident → analyze → recommend guardrail
                </p>
                <div className="mt-6 flex gap-3">
                  <Button asChild>
                    <Link href="/signup">Get Started</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/docs">View Docs</Link>
                  </Button>
                </div>
              </Card>
            </section>
          ) : null}

          <section className="space-y-5">
            {!screenshotMode ? (
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Failure scenario selector</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Choose the failure you want to simulate.</h2>
              </div>
            ) : null}
            <FailureSelector selectedFailure={selectedFailure} onSelect={setSelectedFailure} />
          </section>

          <PlaygroundControlPanel
            scenario={scenario}
            stage={simulationStage}
            screenshotMode={screenshotMode}
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(320px,0.5fr)]">
            <PlaygroundIncident
              scenario={scenario}
              stage={simulationStage}
              onViewTrace={() => traceRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
            />
            <GuardrailRecommendation
              scenario={scenario}
              stage={simulationStage}
              applied={guardrailApplied}
              onApply={applyGuardrail}
            />
          </div>

          <div ref={traceRef}>
            <PlaygroundTraceGraph scenario={scenario} stage={simulationStage} />
          </div>

          {simulationStage === "guardrail_recommended" && !screenshotMode ? <DemoConversionCard /> : null}
        </div>
      </div>
    </main>
  );
}
