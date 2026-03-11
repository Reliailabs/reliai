import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { ControlPanelView } from "@/components/presenters/control-panel-view";
import { DeploymentDetailView } from "@/components/presenters/deployment-detail-view";
import { IncidentCommandCenterView } from "@/components/presenters/incident-command-center-view";
import { TraceGraphView } from "@/components/presenters/trace-graph-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  demoControlPanel,
  demoDeploymentDetail,
  demoGuardrailSummary,
  demoIncidentCommand,
  demoProject,
  demoSuggestedFix,
  demoTraceAnalysis,
  demoTraceGraph,
} from "@/lib/demoData";

const steps = [
  "Control Panel",
  "Incident",
  "Trace Graph",
  "Guardrails",
  "Deployment Gate",
];

export default function DemoPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="grid gap-10">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.6fr)]">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-steel">Guided demo</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">
              See the operator workflow from signal detection to mitigation.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-steel">
              This public walkthrough uses deterministic demo data and the same product surfaces operators use in the authenticated app.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {steps.map((step, index) => (
                <div key={step} className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-steel">
                  <span className="font-medium text-ink">{index + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">What this demo proves</p>
            <div className="mt-5 space-y-4 text-sm leading-7 text-steel">
              <p>Reliai shows whether the system is safe right now.</p>
              <p>Incidents explain what likely broke and what to do next.</p>
              <p>Trace graphs make the failing stage visible without leaving the workflow.</p>
              <p>Deployment gates surface rollout risk before a bad change expands.</p>
            </div>
            <div className="mt-6 flex gap-3">
              <Button asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/sign-in">Sign In</Link>
              </Button>
            </div>
          </Card>
        </section>

        <section id="control-panel" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">01</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Control panel</h2>
            </div>
            <p className="text-sm text-steel">Start at the system status page.</p>
          </div>
          <ControlPanelView
            projectId={demoProject.id}
            projectName={demoProject.name}
            panel={demoControlPanel}
            screenshotMode
          />
        </section>

        <section id="incident" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">02</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Incident investigation</h2>
            </div>
            <p className="text-sm text-steel">The command center narrows root cause and recommended mitigation.</p>
          </div>
          <IncidentCommandCenterView
            incidentId={demoIncidentCommand.incident.id}
            command={demoIncidentCommand}
            suggestedFix={demoSuggestedFix}
            screenshotMode
          />
        </section>

        <section id="trace-graph" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">03</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Trace graph</h2>
            </div>
            <p className="text-sm text-steel">Move from the incident to the exact failing execution path.</p>
          </div>
          <TraceGraphView graph={demoTraceGraph} analysis={demoTraceAnalysis} screenshotMode />
        </section>

        <section id="guardrails" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">04</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Guardrail runtime protection</h2>
            </div>
            <p className="text-sm text-steel">Policies describe what is enforced across the live path.</p>
          </div>
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

        <section id="deployment-gate" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">05</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Deployment safety gate</h2>
            </div>
            <p className="text-sm text-steel">Finish at the rollout gate to decide whether the change is safe.</p>
          </div>
          <DeploymentDetailView detail={demoDeploymentDetail} screenshotMode />
        </section>

        <section className="rounded-[32px] border border-zinc-300 bg-white px-8 py-8 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Next step</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
            Move from evaluation to a real project.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-steel">
            When you are ready, create an account, wire the SDK, and land directly in the operator workflow shown above.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/">Back to overview</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
