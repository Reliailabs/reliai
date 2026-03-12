"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";

import { ControlPanelView } from "@/components/presenters/control-panel-view";
import { DeploymentDetailView } from "@/components/presenters/deployment-detail-view";
import { IncidentCommandCenterView } from "@/components/presenters/incident-command-center-view";
import { TraceGraphView } from "@/components/presenters/trace-graph-view";
import { Card } from "@/components/ui/card";
import {
  demoControlPanel,
  demoDeploymentDetail,
  demoGuardrailSummary,
  demoIncident,
  demoIncidentCommand,
  demoProject,
  demoSuggestedFix,
  demoTrace,
  demoTraceAnalysis,
  demoTraceGraph,
} from "@/lib/demoData";
import { cn } from "@/lib/utils";

import { DemoConversionCard } from "./demo-conversion-card";
import { DemoTour, type DemoTourStep } from "./demo-tour";

const steps = [
  "Failure",
  "System Health",
  "Incident",
  "Trace Graph",
  "Root Cause",
  "Guardrail",
  "Deployment Safety",
] as const;

const tourSteps: DemoTourStep[] = [
  {
    title: "System health overview",
    description:
      "Start at the control panel. Reliability score, active incident count, and the recommended guardrail answer whether the system is safe right now.",
    targetId: "demo-control-panel",
  },
  {
    title: "Incident detection",
    description:
      "Reliai turned the failure into an incident with deployment context, trace evidence, and a clear mitigation path.",
    targetId: "demo-incident",
  },
  {
    title: "Trace execution graph",
    description:
      "Inspect the exact failing request path across retrieval, prompt build, model execution, tool calls, and retries.",
    targetId: "demo-trace-graph",
  },
  {
    title: "Root cause explanation",
    description:
      "The likely cause is a prompt rollout that introduced unsupported references and increased retrieval pressure.",
    targetId: "demo-root-cause",
  },
  {
    title: "Guardrail recommendation",
    description:
      "Operators see which runtime protections should be enabled immediately to reduce blast radius.",
    targetId: "demo-guardrails",
  },
  {
    title: "Deployment safety gate",
    description:
      "Close the loop at the rollout gate. Deployment risk explains whether the change is safe, warning, or blocked.",
    targetId: "demo-deployment-gate",
  },
];

interface DemoExperienceProps {
  screenshotMode?: boolean;
  visualTestMode?: boolean;
}

export function DemoExperience({ screenshotMode = false, visualTestMode = false }: DemoExperienceProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showTour, setShowTour] = useState(false);
  const [entered, setEntered] = useState(screenshotMode || visualTestMode);

  useEffect(() => {
    if (screenshotMode || visualTestMode) {
      setEntered(true);
      return;
    }

    const enterTimer = window.setTimeout(() => setEntered(true), 80);
    const tourTimer = window.setTimeout(() => setShowTour(true), 520);
    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(tourTimer);
    };
  }, [screenshotMode, visualTestMode]);

  useEffect(() => {
    if (screenshotMode || visualTestMode) return;
    const tourIndex = Math.max(currentStep - 1, 0);
    const target = document.querySelector<HTMLElement>(`[data-tour-id="${tourSteps[tourIndex]?.targetId}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentStep, screenshotMode, visualTestMode]);

  const sectionTone = useMemo(
    () => (stepIndex: number) =>
      cn(
        "rounded-[34px] border border-transparent transition-all duration-300",
        currentStep === stepIndex && !screenshotMode && !visualTestMode && "border-sky-300 bg-sky-50/35",
      ),
    [currentStep, screenshotMode, visualTestMode],
  );

  return (
    <main className={cn("mx-auto max-w-7xl px-6 py-12", screenshotMode && "max-w-none px-0 py-0")}>
      <div className="grid gap-10">
        {!screenshotMode ? (
          <section className="sticky top-[73px] z-20 rounded-[28px] border border-zinc-300 bg-white/95 px-5 py-4 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-steel">Reliai Demo</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                  Explore a realistic AI reliability workflow in under two minutes.
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                {steps.map((step, index) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => {
                      setCurrentStep(index);
                      setShowTour(true);
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                      currentStep === index
                        ? "border-ink bg-ink text-white"
                        : "border-zinc-300 bg-white text-steel hover:text-ink",
                    )}
                  >
                    <span className="font-medium">{index + 1}</span>
                    <span>{step}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {!screenshotMode ? (
          <section
            data-tour-id="demo-failure-banner"
            className={cn(
              "grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.6fr)]",
              sectionTone(0),
            )}
          >
            <div className="rounded-[30px] border border-rose-200 bg-rose-50 px-6 py-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-white/80 p-3">
                  <ShieldAlert className="h-5 w-5 text-rose-700" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-rose-700">Simulated failure</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
                    Hallucination spike detected
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-rose-950/85">
                    A prompt update introduced hallucinated responses. Reliai detected the regression, opened an incident, and recommended a guardrail before users noticed.
                  </p>
                </div>
              </div>
            </div>
            <Card className="rounded-[28px] border-zinc-300 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Demo scenario</p>
              <div className="mt-5 space-y-4 text-sm leading-7 text-steel">
                <p>
                  <span className="font-medium text-ink">{demoProject.name}</span> serves production support traffic.
                </p>
                <p>{demoIncident.title} appeared after a prompt rollout and surfaced before end-user complaints arrived.</p>
                <p>This walkthrough shows the full operator loop: detect, explain, mitigate, and decide on rollout safety.</p>
              </div>
            </Card>
          </section>
        ) : null}

        <section
          data-tour-id="demo-control-panel"
          className={cn(
            "space-y-4 transition-opacity duration-500",
            entered ? "opacity-100" : "opacity-0",
            sectionTone(0),
          )}
        >
          {!screenshotMode ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">01</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">System health</h2>
              </div>
              <p className="text-sm text-steel">Start at the control panel.</p>
            </div>
          ) : null}
          <ControlPanelView
            projectId={demoProject.id}
            projectName={demoProject.name}
            panel={demoControlPanel}
            screenshotMode
            highlightedMetrics={["reliability_score", "active_incidents", "recommended_guardrail"]}
          />
        </section>

        <section data-tour-id="demo-incident" className={cn("space-y-4", sectionTone(1))}>
          {!screenshotMode ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">02</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Incident</h2>
              </div>
              <p className="text-sm text-steel">{demoIncident.impact}</p>
            </div>
          ) : null}
          <IncidentCommandCenterView
            incidentId={demoIncidentCommand.incident.id}
            command={demoIncidentCommand}
            suggestedFix={demoSuggestedFix}
            screenshotMode
          />
        </section>

        <section data-tour-id="demo-trace-graph" className={cn("space-y-4", sectionTone(2))}>
          {!screenshotMode ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">03</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Trace graph</h2>
              </div>
              <p className="text-sm text-steel">
                Slowest span: {demoTrace.slowest_span} · Token heavy span: {demoTrace.token_heavy_span}
              </p>
            </div>
          ) : null}
          <TraceGraphView graph={demoTraceGraph} analysis={demoTraceAnalysis} screenshotMode />
        </section>

        <section data-tour-id="demo-root-cause" className={cn("space-y-4", sectionTone(3))}>
          {!screenshotMode ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">04</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Root cause explanation</h2>
              </div>
              <p className="text-sm text-steel">{demoIncident.root_cause}</p>
            </div>
          ) : null}
          <Card className="rounded-[30px] border-zinc-300 p-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(280px,0.55fr)]">
              <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 px-5 py-5">
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Likely cause</p>
                <h3 className="mt-3 text-2xl font-semibold text-ink">{demoIncident.root_cause}</h3>
                <p className="mt-3 text-sm leading-7 text-steel">
                  The failing trace shows retrieval pressure first, then a model response that required guardrail retry. The deployment window lines up with the incident start.
                </p>
              </div>
              <div className="space-y-3">
                <div className="rounded-[24px] border border-zinc-200 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-steel">Failure surface</p>
                  <p className="mt-2 text-sm font-medium text-ink">{demoIncident.impact}</p>
                </div>
                <div className="rounded-[24px] border border-zinc-200 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-steel">Linked signal</p>
                  <p className="mt-2 text-sm font-medium text-ink">Prompt update deployed 82 minutes before incident start.</p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {!screenshotMode && currentStep >= 4 ? <DemoConversionCard /> : null}

        <section data-tour-id="demo-guardrails" className={cn("space-y-4", sectionTone(4))}>
          {!screenshotMode ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">05</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Guardrail recommendation</h2>
              </div>
              <p className="text-sm text-steel">Recommended runtime protections before blast radius expands.</p>
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {demoGuardrailSummary.policies.map((policy) => (
              <Card key={policy.title} className="rounded-[28px] border-zinc-300 p-6">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-steel" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-steel">{policy.mode}</p>
                    <h3 className="mt-2 text-xl font-semibold text-ink">{policy.title}</h3>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-steel">{policy.summary}</p>
              </Card>
            ))}
          </div>
        </section>

        <section data-tour-id="demo-deployment-gate" className={cn("space-y-4", sectionTone(5))}>
          {!screenshotMode ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">06</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Deployment safety</h2>
              </div>
              <p className="text-sm text-steel">Finish at the rollout gate.</p>
            </div>
          ) : null}
          <DeploymentDetailView detail={demoDeploymentDetail} screenshotMode />
        </section>
      </div>

      {showTour && !screenshotMode && !visualTestMode ? (
        <DemoTour
          steps={tourSteps}
          currentStep={Math.max(currentStep - 1, 0)}
          onStepChange={(index) => setCurrentStep(index + 1)}
          onClose={() => setShowTour(false)}
        />
      ) : null}
    </main>
  );
}
