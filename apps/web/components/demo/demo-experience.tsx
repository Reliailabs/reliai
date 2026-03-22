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

const demoSteps = [
  {
    id: "failure",
    label: "Failure",
    title: "Failure detected",
    description:
      "Start with the regression trigger. Reliai flags the failure state and opens an incident as soon as the signal crosses threshold.",
    targetId: "demo-failure-banner",
  },
  {
    id: "control",
    label: "System Health",
    title: "System health overview",
    description:
      "Start at the control panel. Reliability score, active incident count, and the recommended guardrail answer whether the system is safe right now.",
    targetId: "demo-control-panel",
  },
  {
    id: "incident",
    label: "Incident",
    title: "Incident detection",
    description:
      "Reliai turned the failure into an incident with deployment context, trace evidence, and a clear mitigation path.",
    targetId: "demo-incident",
  },
  {
    id: "trace-graph",
    label: "Trace Graph",
    title: "Trace execution graph",
    description:
      "Inspect the exact failing request path across retrieval, prompt build, model execution, tool calls, and retries.",
    targetId: "demo-trace-graph",
  },
  {
    id: "root-cause",
    label: "Root Cause",
    title: "Root cause explanation",
    description:
      "The likely cause is a prompt rollout that introduced unsupported references and increased retrieval pressure.",
    targetId: "demo-root-cause",
  },
  {
    id: "guardrail",
    label: "Guardrail",
    title: "Guardrail recommendation",
    description:
      "Operators see which runtime protections should be enabled immediately to reduce blast radius.",
    targetId: "demo-guardrails",
  },
  {
    id: "deployment",
    label: "Deployment Safety",
    title: "Deployment safety gate",
    description:
      "Close the loop at the rollout gate. Deployment risk explains whether the change is safe, warning, or blocked.",
    targetId: "demo-deployment-gate",
  },
] as const;

const tourSteps: DemoTourStep[] = demoSteps.map(({ title, description, targetId }) => ({
  title,
  description,
  targetId,
}));

interface DemoExperienceProps {
  screenshotMode?: boolean;
  visualTestMode?: boolean;
}

export function DemoExperience({ screenshotMode = false, visualTestMode = false }: DemoExperienceProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showTour, setShowTour] = useState(false);
  const [entered, setEntered] = useState(screenshotMode || visualTestMode);
  const activeStep = demoSteps[currentStep];
  const isActive = (id: (typeof demoSteps)[number]["id"]) => activeStep?.id === id;

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
    if (!activeStep) return;
    const target = document.querySelector<HTMLElement>(`[data-tour-id="${activeStep.targetId}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeStep, screenshotMode, visualTestMode]);

  const sectionTone = useMemo(
    () => (isActive: boolean) =>
      cn(
        "rounded-[34px] border border-transparent transition-all duration-300",
        isActive && !screenshotMode && !visualTestMode && "border-line bg-surface-alt",
      ),
    [screenshotMode, visualTestMode],
  );

  return (
    <main className="app-shell war-room min-h-screen bg-bg text-textPrimary">
      <div className={cn("mx-auto max-w-7xl px-6 py-12", screenshotMode && "max-w-none px-0 py-0")}>
        <div className="grid gap-10">
          {!screenshotMode ? (
          <section className="sticky top-[73px] z-20 rounded-[28px] border border-line bg-surface/95 px-5 py-4 backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-textSecondary">Reliai Demo</p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-textPrimary">
                  Explore a realistic AI reliability workflow in under two minutes.
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                {demoSteps.map((step, index) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      setCurrentStep(index);
                      setShowTour(true);
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                      currentStep === index
                        ? "border-textPrimary bg-textPrimary text-bg"
                        : "border-line bg-surface text-textSecondary hover:text-textPrimary",
                    )}
                  >
                    <span className="font-medium">{index + 1}</span>
                    <span>{step.label}</span>
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
              sectionTone(isActive("failure")),
            )}
          >
            <div className="rounded-[30px] border border-error/30 bg-errorBg px-6 py-6">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-bg p-3">
                  <ShieldAlert className="h-5 w-5 text-error" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-error">Simulated failure</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-textPrimary">
                    Hallucination spike detected
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-textPrimary">
                    A prompt update introduced hallucinated responses. Reliai detected the regression, opened an incident, and recommended a guardrail before users noticed.
                  </p>
                </div>
              </div>
            </div>
            <Card className="rounded-[28px] border-line p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-textSecondary">Demo scenario</p>
              <div className="mt-5 space-y-4 text-sm leading-7 text-textSecondary">
                <p>
                  <span className="font-medium text-textPrimary">{demoProject.name}</span> serves production support traffic.
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
            sectionTone(isActive("control")),
          )}
        >
          {!screenshotMode ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-textSecondary">01</p>
                <h2 className="mt-2 text-2xl font-semibold text-textPrimary">System health</h2>
              </div>
              <p className="text-sm text-textSecondary">Start at the control panel.</p>
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

        <section data-tour-id="demo-incident" className={cn("space-y-4", sectionTone(isActive("incident")))}>
          {!screenshotMode ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-textSecondary">02</p>
                <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Incident</h2>
              </div>
              <p className="text-sm text-textSecondary">{demoIncident.impact}</p>
            </div>
          ) : null}
          <IncidentCommandCenterView
            incidentId={demoIncidentCommand.incident.id}
            command={demoIncidentCommand}
            suggestedFix={demoSuggestedFix}
            screenshotMode
          />
        </section>

        <section data-tour-id="demo-trace-graph" className={cn("space-y-4", sectionTone(isActive("trace-graph")))}>
          {!screenshotMode ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-textSecondary">03</p>
                <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Trace graph</h2>
              </div>
              <p className="text-sm text-textSecondary">
                Slowest span: {demoTrace.slowest_span} · Token heavy span: {demoTrace.token_heavy_span}
              </p>
            </div>
          ) : null}
          <div className="demo-trace-war-room app-shell war-room rounded-2xl border border-line bg-surface px-3 py-3">
            <TraceGraphView graph={demoTraceGraph} analysis={demoTraceAnalysis} screenshotMode />
          </div>
        </section>

        <section data-tour-id="demo-root-cause" className={cn("space-y-4", sectionTone(isActive("root-cause")))}>
          {!screenshotMode ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-textSecondary">04</p>
                <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Root cause explanation</h2>
              </div>
              <p className="text-sm text-textSecondary">{demoIncident.root_cause}</p>
            </div>
          ) : null}
          <Card className="rounded-[30px] border-line p-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(280px,0.55fr)]">
              <div className="rounded-[24px] border border-line bg-surface-alt px-5 py-5">
                <p className="text-xs uppercase tracking-[0.24em] text-textSecondary">Likely cause</p>
                <h3 className="mt-3 text-2xl font-semibold text-textPrimary">{demoIncident.root_cause}</h3>
                <p className="mt-3 text-sm leading-7 text-textSecondary">
                  The failing trace shows retrieval pressure first, then a model response that required guardrail retry. The deployment window lines up with the incident start.
                </p>
              </div>
              <div className="space-y-3">
                <div className="rounded-[24px] border border-line px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-textSecondary">Failure surface</p>
                  <p className="mt-2 text-sm font-medium text-textPrimary">{demoIncident.impact}</p>
                </div>
                <div className="rounded-[24px] border border-line px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-textSecondary">Linked signal</p>
                  <p className="mt-2 text-sm font-medium text-textPrimary">Prompt update deployed 82 minutes before incident start.</p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {!screenshotMode && currentStep >= 4 ? <DemoConversionCard /> : null}

        <section data-tour-id="demo-guardrails" className={cn("space-y-4", sectionTone(isActive("guardrail")))}>
          {!screenshotMode ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-textSecondary">05</p>
                <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Guardrail recommendation</h2>
              </div>
              <p className="text-sm text-textSecondary">Recommended runtime protections before blast radius expands.</p>
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {demoGuardrailSummary.policies.map((policy) => (
              <Card key={policy.title} className="rounded-[28px] border-line p-6">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-textSecondary" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-textSecondary">{policy.mode}</p>
                    <h3 className="mt-2 text-xl font-semibold text-textPrimary">{policy.title}</h3>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-textSecondary">{policy.summary}</p>
              </Card>
            ))}
          </div>
        </section>

        <section data-tour-id="demo-deployment-gate" className={cn("space-y-4", sectionTone(isActive("deployment")))}>
          {!screenshotMode ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-textSecondary">06</p>
                <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Deployment safety</h2>
              </div>
              <p className="text-sm text-textSecondary">Finish at the rollout gate.</p>
            </div>
          ) : null}
          <DeploymentDetailView detail={demoDeploymentDetail} screenshotMode />
        </section>
        </div>

      {showTour && !screenshotMode && !visualTestMode ? (
        <DemoTour
          steps={tourSteps}
          currentStep={currentStep}
          onStepChange={(index) => setCurrentStep(index)}
          onClose={() => setShowTour(false)}
        />
      ) : null}
      </div>
    </main>
  );
}
