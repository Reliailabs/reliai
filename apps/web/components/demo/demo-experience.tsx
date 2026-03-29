"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";

import { ControlPanelView } from "@/components/presenters/control-panel-view";
import { IncidentCommandCenterView } from "@/components/presenters/incident-command-center-view";
import { TraceGraphView } from "@/components/presenters/trace-graph-view";
import { Card } from "@/components/ui/card";
import {
  demoControlPanel,
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
    label: "Detect",
    title: "Hallucination spike detected",
    description:
      "INC-1423 opened automatically. Failure rate hit 19% — vs 4% baseline — within 82 minutes of a prompt rollout. Reliai caught it before a single user complaint arrived.",
    targetId: "demo-failure-banner",
  },
  {
    id: "control",
    label: "Understand",
    title: "System health overview",
    description:
      "The control panel shows the full picture: reliability score, active incident, and what needs attention first. One screen answers whether the system is safe right now.",
    targetId: "demo-control-panel",
  },
  {
    id: "incident",
    label: "Incident",
    title: "Incident command center",
    description:
      "INC-1423 surfaces deployment context, trace evidence, and a concrete fix — all in one place. No log diving required.",
    targetId: "demo-incident",
  },
  {
    id: "trace-graph",
    label: "Compare",
    title: "Trace comparison",
    description:
      "The failing trace (prompt v42) vs the baseline trace (prompt v41) side by side. Retrieval latency climbed 139%. The regression surface is immediately visible.",
    targetId: "demo-trace-graph",
  },
  {
    id: "root-cause",
    label: "Root Cause",
    title: "Root cause — 71% confidence",
    description:
      "Prompt v42 deployed 82 minutes before the incident. Confidence: 71%. The evidence chain connects deployment time, retrieval pressure, and hallucination concentration.",
    targetId: "demo-root-cause",
  },
  {
    id: "guardrail",
    label: "Fix",
    title: "Apply the fix",
    description:
      "Revert to v41. Enable latency retry. The fix is specific and actionable — no ambiguity about what to do next.",
    targetId: "demo-guardrails",
  },
  {
    id: "deployment",
    label: "Prove",
    title: "Fix verified",
    description:
      "Failure rate dropped from 19% → 5% after reverting prompt v42. Resolved in 6 minutes. The loop is complete: detect, understand, fix, prove.",
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
                  <p className="text-xs uppercase tracking-[0.24em] text-error">Simulated failure · INC-1423</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-textPrimary">
                    Hallucination spike detected
                  </h2>
                  <p className="mt-1 text-xs text-textSecondary">
                    AI Support Copilot · Production · Mar 11, 10:22 AM
                  </p>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-textPrimary">
                    Failure rate hit <span className="font-semibold text-error">19%</span> — vs <span className="font-semibold">4%</span> baseline. Reliai detected the regression, opened the incident, and identified the fix before users noticed.
                  </p>
                </div>
              </div>
            </div>
            <Card className="rounded-[28px] border-line p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-textSecondary">Demo scenario</p>
              <div className="mt-5 space-y-4 text-sm leading-7 text-textSecondary">
                <p>
                  This is <span className="font-medium text-textPrimary">INC-1423</span> — the same incident from the homepage, live in the product.
                </p>
                <p>
                  <span className="font-medium text-textPrimary">{demoProject.name}</span> · Production · Failure rate{" "}
                  <span className="font-medium text-error">19%</span> vs{" "}
                  <span className="font-medium text-textPrimary">4%</span> baseline.
                </p>
                <p>Follow the loop: Detect → Understand → Compare → Root Cause → Fix → Prove.</p>
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
                <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Understand — System health</h2>
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
                <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Compare — Trace graph</h2>
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
                <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Fix</h2>
              </div>
              <p className="text-sm text-textSecondary">Revert v42 → enable protections → failure rate returns to baseline.</p>
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
                <h2 className="mt-2 text-2xl font-semibold text-textPrimary">Prove</h2>
              </div>
              <p className="text-sm text-textSecondary">Fix verified — the loop is complete.</p>
            </div>
          ) : null}
          <div className="rounded-[30px] border border-green-200 bg-green-50 px-6 py-8">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-green-100 p-3">
                <CheckCircle2 className="h-6 w-6 text-green-700" />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-[0.24em] text-green-700">Fix verified · INC-1423</p>
                <h3 className="mt-2 text-3xl font-semibold tracking-tight text-green-900">
                  Failure rate reduced from 19% → 5% ✓
                </h3>
                <p className="mt-2 text-sm text-green-800">After reverting prompt v42 · Resolved in 6 minutes</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-green-200 bg-white/70 px-4 py-4 text-center">
                    <p className="text-xs uppercase tracking-[0.18em] text-green-700">Before</p>
                    <p className="mt-2 text-3xl font-bold text-red-600">19%</p>
                    <p className="mt-1 text-xs text-green-700">failure rate</p>
                  </div>
                  <div className="rounded-2xl border border-green-200 bg-white/70 px-4 py-4 text-center">
                    <p className="text-xs uppercase tracking-[0.18em] text-green-700">Baseline</p>
                    <p className="mt-2 text-3xl font-bold text-zinc-500">4%</p>
                    <p className="mt-1 text-xs text-green-700">healthy baseline</p>
                  </div>
                  <div className="rounded-2xl border border-green-200 bg-green-100 px-4 py-4 text-center">
                    <p className="text-xs uppercase tracking-[0.18em] text-green-700">After Fix</p>
                    <p className="mt-2 text-3xl font-bold text-green-700">5% ✓</p>
                    <p className="mt-1 text-xs text-green-700">near baseline</p>
                  </div>
                </div>
                <p className="mt-5 text-sm text-green-800">
                  Based on live production traces · Root cause confidence 71% · Prompt v41 restored
                </p>
              </div>
            </div>
          </div>
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
