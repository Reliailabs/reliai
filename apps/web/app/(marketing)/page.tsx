import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Cpu,
  Radar,
  ShieldCheck,
  Siren,
  TriangleAlert,
  Workflow,
} from "lucide-react";

import { ControlPanelPreview } from "@/components/marketing/control-panel-preview";
import { FailureTimeline } from "@/components/marketing/failure-timeline";
import {
  marketingCardClass,
  marketingContainerClass,
  marketingMetricClass,
  marketingSectionClass,
  marketingSectionLargeClass,
  MarketingScreenshotCard,
} from "@/components/marketing/spatial-system";
import { SdkInstallSection } from "@/components/marketing/sdk-install-section";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const productPillars = [
  {
    title: "Instrument",
    body: "SDKs capture traces and pipeline spans across retrieval, prompt construction, model calls, and guardrails.",
    icon: Radar,
  },
  {
    title: "Detect",
    body: "Reliai identifies reliability regressions, runtime failures, and risky deployment changes before users notice them.",
    icon: TriangleAlert,
  },
  {
    title: "Investigate",
    body: "Trace graphs, incident analysis, and replay flows reveal what changed, where the system failed, and why.",
    icon: Cpu,
  },
  {
    title: "Protect",
    body: "Guardrails and deployment gates keep known failure modes from reaching production users.",
    icon: ShieldCheck,
  },
];

const reliabilityLoop = ["Trace", "Detect", "Investigate", "Mitigate", "Prevent"];

const demoFlow = [
  {
    step: "01",
    title: "Start at the control panel",
    body: "Operators answer the first question immediately: Is my AI system safe right now?",
  },
  {
    step: "02",
    title: "Open the incident",
    body: "Reliai turns regressions into incidents with linked traces, deployment windows, and candidate causes.",
  },
  {
    step: "03",
    title: "Inspect the trace graph",
    body: "Execution graphs make the failing stage visible across retrieval, prompt build, model, tool, and guardrail spans.",
  },
  {
    step: "04",
    title: "Mitigate before blast radius expands",
    body: "Recommended guardrails and deployment gates give the operator a concrete next action.",
  },
];

const productionSignals = [
  {
    label: "Reliability score",
    value: "92 / 100",
  },
  {
    label: "Active incidents detected",
    value: "1",
  },
  {
    label: "Guardrails protecting pipelines",
    value: "17",
  },
  {
    label: "Traces analyzed this week",
    value: "2.3M",
  },
];

interface MarketingHomePageProps {
  searchParams?: Promise<{ visual?: string }>;
}

export default async function MarketingHomePage({ searchParams }: MarketingHomePageProps) {
  const params = await searchParams;
  const visualTestMode = params?.visual === "1";

  return (
    <main className="overflow-x-hidden bg-[#f7f8fa]">
      <section className="relative overflow-hidden border-b border-zinc-200">
        <div className="absolute inset-x-0 top-0 h-[40rem] bg-[radial-gradient(circle_at_65%_16%,rgba(255,255,255,0.78),transparent_24%),radial-gradient(circle_at_top_right,rgba(15,23,42,0.08),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,248,250,1))]" />
        <div className={`${marketingContainerClass} relative pb-8 pt-24 lg:pt-28`}>
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.32em] text-steel">AI reliability control plane</p>
            <h1 className="mt-5 text-5xl font-semibold tracking-tight text-ink lg:text-6xl">
              Know when your AI breaks—before your users do.
            </h1>
            <p className="mt-6 text-lg leading-8 text-steel">
              Reliai detects AI regressions, explains root causes, and applies guardrails to protect production systems.
            </p>
            <div className="mt-6 flex max-w-[600px] flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-300 bg-white px-4 py-3 shadow-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-steel">Install</p>
                  <code className={`mt-1 block overflow-x-auto text-sm font-medium text-ink ${marketingMetricClass}`}>
                    pip install reliai
                  </code>
                </div>
                <CopyButton value="pip install reliai" label="Copy" />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/playground">
                    Try Playground
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/demo">View Demo</Link>
                </Button>
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-medium text-steel transition hover:bg-white hover:text-ink"
                >
                  Get Started
                </Link>
              </div>
            </div>
            <div className="mt-8">
              <p className="text-sm font-medium text-ink">Used to protect production AI systems</p>
              <div className="mt-3 grid grid-cols-2 gap-6 md:grid-cols-4">
                {productionSignals.map((signal) => (
                  <div
                    key={signal.label}
                    className="flex flex-col items-start gap-1 rounded-lg border border-zinc-200 bg-white p-4"
                  >
                    <p className="text-sm text-zinc-500">{signal.label}</p>
                    <p className="text-2xl font-mono font-semibold text-ink">{signal.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-12 space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className={`${marketingCardClass} h-full`}>
                <p className="text-xs uppercase tracking-[0.18em] text-steel">System health</p>
                <p className={`mt-3 text-3xl font-semibold text-emerald-700 ${marketingMetricClass}`}>92 / 100</p>
                <p className="mt-2 text-sm text-steel">Reliability score with one active incident under control.</p>
              </Card>
              <Card className={`${marketingCardClass} h-full`}>
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Incident detection</p>
                <p className={`mt-3 text-3xl font-semibold text-rose-700 ${marketingMetricClass}`}>1</p>
                <p className="mt-2 text-sm text-steel">Retrieval latency regression opened automatically.</p>
              </Card>
              <Card className={`${marketingCardClass} h-full`}>
                <p className="text-xs uppercase tracking-[0.18em] text-steel">Recommended action</p>
                <p className={`mt-3 text-lg font-semibold text-amber-700 ${marketingMetricClass}`}>Enable retry policy</p>
                <p className="mt-2 text-sm text-steel">Suggested guardrail for the retrieval stage.</p>
              </Card>
            </div>

            <div className="relative -mb-20 mt-6 flex justify-center lg:-mb-24">
              <div className="absolute inset-x-24 top-4 -z-10 h-[86%] rounded-[999px] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.92),rgba(255,255,255,0.36)_38%,transparent_72%)] blur-3xl" />
              <div
                className="relative w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_40px_120px_rgba(15,23,42,0.22)]"
                style={visualTestMode ? undefined : { transform: "perspective(1400px) rotateX(6deg)" }}
              >
                <div className="flex items-center gap-2 border-b border-zinc-200 bg-[linear-gradient(180deg,#fbfbfc,#f1f3f6)] px-5 py-3">
                  <span className="h-3 w-3 rounded-full bg-rose-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  <span className="ml-3 text-[11px] uppercase tracking-[0.18em] text-steel">Reliai control panel</span>
                </div>
                <div className="aspect-video overflow-hidden bg-zinc-100">
                  <div className="h-full w-full">
                    <Image
                      src="/screenshots/control-panel.png"
                      alt="Reliai control panel showing reliability score, incident detection, and recommended guardrails"
                      width={3200}
                      height={2000}
                      className="block h-full w-full object-cover object-top [image-rendering:-webkit-optimize-contrast]"
                      style={{ objectPosition: "left top" }}
                      priority
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`border-b border-zinc-200 bg-white ${marketingSectionLargeClass}`}>
        <div className={`${marketingContainerClass} py-16`}>
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
            <div className="flex h-full flex-col">
              <Card className={`${marketingCardClass} h-full flex flex-col`}>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Failure story</p>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight text-ink">
                  AI systems fail in ways traditional observability tools cannot detect.
                </h2>
                <p className="mt-5 text-base leading-8 text-steel">
                  A prompt update introduced hallucinated responses. Reliai detected the regression, opened an incident,
                  explained the likely cause, and recommended a guardrail before users noticed.
                </p>
                <div className="mt-8 flex-1">
                  <FailureTimeline disableAnimation={visualTestMode} />
                </div>
              </Card>
            </div>

            <div className="flex h-full flex-col">
              <Card className={`${marketingCardClass} h-full flex flex-col`}>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">What the operator sees</p>
                <h3 className="mt-3 text-2xl font-semibold text-ink">
                  Reliability score, active incident, and recommended guardrail in one view.
                </h3>
                <p className="mt-3 text-sm leading-7 text-steel">
                  The screenshot stays focused on the signals that matter first: system health, detected failure, and
                  the next mitigation step.
                </p>
                <div className="mt-8 flex-1">
                  <ControlPanelPreview />
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className={`${marketingContainerClass} ${marketingSectionClass} py-16`}>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
          <Card className={`${marketingCardClass} h-full`}>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Interactive demo</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-ink">
              Walk the operator workflow in under five minutes.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-steel">
              Start at system status, open the incident, inspect the trace graph, and finish at the mitigation point.
            </p>
            <div className="mt-12 grid gap-6">
              {demoFlow.map((item) => (
                <div key={item.step} className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-steel">{item.step}</p>
                  <p className="mt-2 text-lg font-semibold text-ink">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-steel">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Button asChild size="lg">
                <Link href="/demo">
                  View Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>

          <div className="grid justify-start gap-6">
            <Card className={`${marketingCardClass} flex w-full max-w-[478px] flex-col overflow-hidden p-0`}>
              <div className="border-b border-zinc-200 bg-white px-5 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Control Panel</p>
                <p className="mt-1.5 text-sm leading-6 text-steel">
                  Reliability score, active incident load, and the next operator action in one surface.
                </p>
              </div>
              <MarketingScreenshotCard
                alt="Control Panel"
                src="/screenshots/control-panel.png"
                className="flex-1 rounded-none border-0 shadow-none"
                viewportClassName="bg-white"
              />
            </Card>
            <Card className={`${marketingCardClass} flex w-full max-w-[478px] flex-col overflow-hidden p-0`}>
              <div className="border-b border-zinc-200 bg-white px-5 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Incident Command Center</p>
                <p className="mt-1.5 text-sm leading-6 text-steel">
                  Root-cause signals, mitigation guidance, and remediation context for live incident response.
                </p>
              </div>
              <MarketingScreenshotCard
                alt="Incident Command Center"
                src="/screenshots/incident.png"
                className="flex-1 rounded-none border-0 shadow-none"
                viewportClassName="bg-white"
              />
            </Card>
            <Card className={`${marketingCardClass} flex w-full max-w-[478px] flex-col overflow-hidden p-0`}>
              <div className="border-b border-zinc-200 bg-white px-5 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Trace Graph</p>
                <p className="mt-1.5 text-sm leading-6 text-steel">
                  Execution graph for retrieval, prompt build, model call, tool execution, and post-processing spans.
                </p>
              </div>
              <MarketingScreenshotCard
                alt="Trace Graph"
                src="/screenshots/trace-graph.png"
                className="flex-1 rounded-none border-0 shadow-none"
                viewportClassName="bg-white"
              />
            </Card>
          </div>
        </div>
      </section>

      <section className={`border-y border-zinc-200 bg-white ${marketingSectionClass}`}>
        <div className={`${marketingContainerClass} py-16`}>
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-steel">Playground</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
                Paste a prompt. See the execution path immediately.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-steel">
                The playground is the fastest way to understand Reliai. Run a request, inspect the trace graph, and
                see how the control plane would analyze the system.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/playground">
                    Try Playground
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/demo">See full operator flow</Link>
                </Button>
              </div>
            </div>
            <Card className={marketingCardClass}>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">What engineers see</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  Prompt input
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  Trace graph
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  Reliability signals
                </p>
              </div>
              <MarketingScreenshotCard
                alt="Playground"
                src="/screenshots/playground.png"
                className="mt-12"
                viewportClassName="bg-white"
              />
              <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-6">
                <p className="text-sm leading-7 text-steel">
                  The playground is the fastest path to product understanding for engineers evaluating the control plane.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className={`${marketingContainerClass} ${marketingSectionClass} py-16`}>
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.28em] text-steel">The Reliai loop</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
            Reliai runs a continuous reliability loop around production AI systems.
          </h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {reliabilityLoop.map((item, index) => (
            <Card key={item} className={`${marketingCardClass} h-full`}>
                <p className="text-xs uppercase tracking-[0.22em] text-steel">Step {index + 1}</p>
                <p className={`mt-3 text-xl font-semibold text-ink ${marketingMetricClass}`}>{item}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className={`border-y border-zinc-200 bg-white ${marketingSectionClass}`}>
        <div className={`${marketingContainerClass} py-16`}>
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.28em] text-steel">Architecture in motion</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              Four operator workflows take the system from telemetry to protection.
            </h2>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-4">
            {productPillars.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className={`${marketingCardClass} h-full flex flex-col justify-between`}>
                  <div>
                    <Icon className="h-5 w-5 text-steel" />
                    <h3 className="mt-4 text-xl font-semibold text-ink">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-steel">{item.body}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <SdkInstallSection />

      <section className={`${marketingContainerClass} ${marketingSectionClass} overflow-x-hidden py-12`}>
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.28em] text-steel">Architecture</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
            The control plane sits between the AI system and the production operator.
          </h2>
        </div>
        <div className="mx-auto mt-16 max-w-[900px]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {[
              { label: "AI Application", icon: Bot },
              { label: "Reliai SDK", icon: Radar },
              { label: "Reliai Control Plane", icon: Workflow },
              { label: "Operators", icon: Siren },
            ].flatMap((item, index, list) => {
              const Icon = item.icon;
              const nodes = [
                <div
                  key={item.label}
                  className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-steel">Stage {index + 1}</p>
                  <Icon className="mx-auto mt-4 h-6 w-6 text-steel" />
                  <p className="mt-4 text-lg font-semibold text-ink">{item.label}</p>
                </div>,
              ];

              if (index < list.length - 1) {
                nodes.push(
                  <div
                    key={`${item.label}-arrow`}
                    className="hidden shrink-0 text-xl text-zinc-400 lg:block"
                    aria-hidden="true"
                  >
                    →
                  </div>,
                );
              }

              return nodes;
            })}
          </div>
        </div>
      </section>

      <section className={`${marketingContainerClass} ${marketingSectionClass} py-12`}>
        <div className="mx-auto max-w-4xl">
          <Card className={`${marketingCardClass} bg-[linear-gradient(180deg,#ffffff,#f5f6f8)]`}>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Run your AI systems with reliability</p>
            <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-ink">
              Make reliability visible before failures hit users.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-steel">
              Reliai gives operators one control plane for tracing, detection, investigation, deployment safety, and
              runtime protection.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/signup">Start Free</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/demo">
                  View Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
