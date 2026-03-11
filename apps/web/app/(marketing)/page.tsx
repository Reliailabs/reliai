import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Network, Radar, ShieldCheck, Siren } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { nodeSnippet, pythonSnippet } from "@/lib/demoData";

const loop = [
  {
    title: "Capture executions",
    body: "SDK traces and spans map every AI request, retrieval stage, and guardrail intervention.",
  },
  {
    title: "Detect regressions",
    body: "Reliai flags behavioral changes, latency shifts, and structured output failures in production.",
  },
  {
    title: "Open incidents",
    body: "Incidents form around the failing metric, linked traces, and deployment window.",
  },
  {
    title: "Investigate root cause",
    body: "Operators move from control panel to incident to trace graph without losing context.",
  },
  {
    title: "Apply mitigation",
    body: "Guardrails, rollout gates, and reliability actions contain the failure before it spreads.",
  },
  {
    title: "Learn from failures",
    body: "Reliability patterns feed deployment risk scoring and future guardrail recommendations.",
  },
];

const problemPoints = [
  "AI regressions hide inside prompts, retrieval stages, and model routing.",
  "Application logs explain infrastructure failures, not AI behavior changes.",
  "Teams need one operational surface that connects incidents, traces, guardrails, and deployments.",
];

const screenshotCards = [
  {
    title: "System Health",
    body: "Control panel view that answers whether the AI system is safe right now.",
    src: "/screenshots/control-panel.png",
  },
  {
    title: "Execution Graph",
    body: "Trace debugging view that highlights the slowest span, token-heavy span, and guardrail retries.",
    src: "/screenshots/trace-graph.png",
  },
  {
    title: "Incident Investigation",
    body: "Command center view that explains likely root cause and recommended mitigation.",
    src: "/screenshots/incident.png",
  },
  {
    title: "Deployment Safety",
    body: "Gate decision that makes rollout risk visible before a bad release expands.",
    src: "/screenshots/deployment.png",
  },
];

export default function MarketingHomePage() {
  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 pb-16 pt-16 lg:pb-24 lg:pt-24">
          <div className="grid items-end gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(560px,0.98fr)]">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-steel">AI reliability control plane</p>
              <h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-tight text-ink lg:text-6xl">
                The Reliability Control Plane for Production AI
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-steel">
                Reliai detects AI regressions, explains root causes, and applies guardrails before failures impact users.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/demo">
                    View Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/signup">Get Started</Link>
                </Button>
              </div>
              <div className="mt-8 grid gap-3 text-sm text-steel">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  Trace ingestion, regression detection, incidents, guardrails, and deployment gates in one operator flow.
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  Built for engineers evaluating production AI systems, not prompt playgrounds.
                </p>
              </div>
            </div>

            <div className="rounded-[36px] border border-zinc-300 bg-white p-3 shadow-[0_30px_80px_rgba(15,23,42,0.10)]">
              <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-zinc-100">
                <Image
                  src="/screenshots/control-panel.png"
                  alt="Reliai control panel screenshot"
                  width={1600}
                  height={1000}
                  className="h-auto w-full"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-steel">Problem</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              Production AI fails across systems, not just inside prompts.
            </h2>
          </div>
          <div className="grid gap-4">
            {problemPoints.map((item) => (
              <Card key={item} className="rounded-[28px] border-zinc-300 p-5">
                <p className="text-sm leading-7 text-steel">{item}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.28em] text-steel">Reliai loop</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">A continuous reliability loop around production AI systems.</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loop.map((item, index) => (
            <Card key={item.title} className="rounded-[28px] border-zinc-300 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Step {index + 1}</p>
              <h3 className="mt-3 text-xl font-semibold text-ink">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-steel">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.28em] text-steel">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              Reliai sits between AI systems and production operators.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <Card className="rounded-[28px] border-zinc-300 p-6">
              <Radar className="h-5 w-5 text-steel" />
              <h3 className="mt-4 text-xl font-semibold text-ink">Observe runtime behavior</h3>
              <p className="mt-3 text-sm leading-7 text-steel">
                SDK traces capture spans, guardrail activity, evaluations, and request metadata on the live path.
              </p>
            </Card>
            <Card className="rounded-[28px] border-zinc-300 p-6">
              <Siren className="h-5 w-5 text-steel" />
              <h3 className="mt-4 text-xl font-semibold text-ink">Open explainable incidents</h3>
              <p className="mt-3 text-sm leading-7 text-steel">
                Incidents connect regressions, failing traces, deployment windows, and reliability patterns.
              </p>
            </Card>
            <Card className="rounded-[28px] border-zinc-300 p-6">
              <ShieldCheck className="h-5 w-5 text-steel" />
              <h3 className="mt-4 text-xl font-semibold text-ink">Enforce runtime protection</h3>
              <p className="mt-3 text-sm leading-7 text-steel">
                Guardrails, policy compliance, and deployment gates reduce blast radius before failures spread.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.28em] text-steel">Product screenshots</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">One demo flow from system status to mitigation.</h2>
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {screenshotCards.map((item) => (
            <Card key={item.title} className="overflow-hidden rounded-[30px] border-zinc-300">
              <div className="border-b border-zinc-200 bg-white px-6 py-5">
                <p className="text-xs uppercase tracking-[0.24em] text-steel">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-steel">{item.body}</p>
              </div>
              <div className="bg-zinc-100 p-3">
                <Image src={item.src} alt={item.title} width={1600} height={1000} className="h-auto w-full rounded-[20px] border border-zinc-200" />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)]">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-steel">Developer integration</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Add tracing without rebuilding your stack.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-steel">
              Instrument requests, retrieval, tool calls, and guardrails directly from the application path. Reliai stays focused on operator workflows, not sample-app demos.
            </p>
          </div>
          <div className="grid gap-4">
            <Card className="rounded-[28px] border-zinc-300 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Python</p>
              <pre className="mt-4 overflow-x-auto rounded-[22px] bg-zinc-950 p-4 text-sm leading-7 text-zinc-100">{pythonSnippet}</pre>
            </Card>
            <Card className="rounded-[28px] border-zinc-300 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Node</p>
              <pre className="mt-4 overflow-x-auto rounded-[22px] bg-zinc-950 p-4 text-sm leading-7 text-zinc-100">{nodeSnippet}</pre>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.28em] text-steel">Architecture</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Designed as an operational control plane, not an analytics sidecar.</h2>
        </div>
        <div className="mt-8 flex flex-col items-center gap-4 lg:flex-row lg:justify-between">
          {[
            { label: "AI Application", icon: Network },
            { label: "Reliai SDK", icon: Radar },
            { label: "Reliai Control Plane", icon: ShieldCheck },
            { label: "Operators", icon: Siren },
          ].map((item, index, list) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex w-full items-center gap-4 lg:w-auto">
                <Card className="flex min-h-36 flex-1 items-center justify-center rounded-[28px] border-zinc-300 px-8 py-8 lg:w-64">
                  <div className="text-center">
                    <Icon className="mx-auto h-6 w-6 text-steel" />
                    <p className="mt-4 text-lg font-semibold text-ink">{item.label}</p>
                  </div>
                </Card>
                {index < list.length - 1 ? <ArrowRight className="hidden h-5 w-5 text-steel lg:block" /> : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <Card className="rounded-[36px] border-zinc-300 bg-[linear-gradient(180deg,#ffffff,#f5f6f8)] p-8 lg:p-10">
            <p className="text-xs uppercase tracking-[0.28em] text-steel">Run production AI with reliability</p>
            <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-ink">
              Run your AI systems with reliability.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-steel">
              Evaluate the product through the guided demo, then move into the operator app when you are ready to wire a real project.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/signup">Start Free</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/demo">View Demo</Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
