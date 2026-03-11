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
import { SdkInstallSection } from "@/components/marketing/sdk-install-section";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { nodeSnippet, pythonSnippet } from "@/lib/demoData";

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

const screenshots = [
  {
    title: "Control Panel",
    body: "System health, incident pressure, recommended guardrails, and recent changes in one operator surface.",
    src: "/screenshots/control-panel.png",
  },
  {
    title: "Trace Graph",
    body: "Execution graph for retrieval, prompt build, model call, tool execution, and post-processing spans.",
    src: "/screenshots/trace-graph.png",
  },
  {
    title: "Incident Command Center",
    body: "Root-cause signals, mitigation guidance, and remediation context for live incident response.",
    src: "/screenshots/incident.png",
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

export default function MarketingHomePage() {
  return (
    <main className="bg-[#f7f8fa]">
      <section className="relative overflow-hidden border-b border-zinc-200">
        <div className="absolute inset-x-0 top-0 h-[40rem] bg-[radial-gradient(circle_at_65%_16%,rgba(255,255,255,0.78),transparent_24%),radial-gradient(circle_at_top_right,rgba(15,23,42,0.08),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,248,250,1))]" />
        <div className="relative mx-auto max-w-7xl px-6 pb-6 pt-14 lg:pt-18">
          <div className="mx-auto max-w-4xl">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.32em] text-steel">AI reliability control plane</p>
              <h1 className="mt-5 text-5xl font-semibold tracking-tight text-ink lg:text-6xl">
                Know when your AI breaks—before your users do.
              </h1>
              <p className="mt-6 text-lg leading-8 text-steel">
                Reliai detects AI regressions, explains root causes, and applies guardrails to protect production systems.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3 rounded-[20px] border border-zinc-300 bg-white px-4 py-3 shadow-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-steel">Install</p>
                  <code className="mt-1 block overflow-x-auto text-sm font-medium text-ink">pip install reliai</code>
                </div>
                <CopyButton value="pip install reliai" label="Copy" />
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
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
              <div className="mt-8">
                <p className="text-sm font-medium text-ink">Used to protect production AI systems</p>
                <div className="mt-3 grid gap-3 text-sm text-steel sm:grid-cols-3">
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    Detect regressions automatically
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    Trace every AI request
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    Apply runtime guardrails
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="rounded-[24px] border-zinc-300 bg-white/90 p-4 shadow-sm backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-steel">System health</p>
                  <p className="mt-3 text-3xl font-semibold text-emerald-700">92 / 100</p>
                  <p className="mt-2 text-sm text-steel">Reliability score with one active incident under control.</p>
                </Card>
                <Card className="rounded-[24px] border-zinc-300 bg-white/90 p-4 shadow-sm backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-steel">Incident detection</p>
                  <p className="mt-3 text-3xl font-semibold text-ink">1</p>
                  <p className="mt-2 text-sm text-steel">Retrieval latency regression opened automatically.</p>
                </Card>
                <Card className="rounded-[24px] border-zinc-300 bg-white/90 p-4 shadow-sm backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-steel">Recommended action</p>
                  <p className="mt-3 text-lg font-semibold text-ink">Enable retry policy</p>
                  <p className="mt-2 text-sm text-steel">Suggested guardrail for the retrieval stage.</p>
                </Card>
              </div>

              <div className="relative -mb-20 mt-6 flex justify-center lg:-mb-24">
                <div className="absolute inset-x-[12%] top-[4%] -z-10 h-[86%] rounded-[999px] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.92),rgba(255,255,255,0.36)_38%,transparent_72%)] blur-3xl" />
                <div
                  className="relative w-full max-w-[1600px] overflow-hidden rounded-[34px] border border-zinc-300/90 bg-white shadow-[0_40px_120px_rgba(15,23,42,0.22)]"
                  style={{ transform: "perspective(1400px) rotateX(6deg)" }}
                >
                  <div className="flex items-center gap-2 border-b border-zinc-200 bg-[linear-gradient(180deg,#fbfbfc,#f1f3f6)] px-5 py-3">
                    <span className="h-3 w-3 rounded-full bg-rose-400" />
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400" />
                    <span className="ml-3 text-[11px] uppercase tracking-[0.18em] text-steel">Reliai control panel</span>
                  </div>
                  <div className="overflow-hidden bg-zinc-100">
                    <div className="w-[1600px] max-w-none origin-top-left scale-[1.02]">
                      <Image
                        src="/screenshots/control-panel.png"
                        alt="Reliai control panel showing reliability score, incident detection, and recommended guardrails"
                        width={3200}
                        height={2000}
                        className="block h-auto w-full object-left-top [image-rendering:-webkit-optimize-contrast]"
                        priority
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-white pt-24 lg:pt-32">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 xl:grid-cols-[minmax(0,0.76fr)_minmax(360px,0.5fr)]">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-steel">Failure story</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-ink">
              AI systems fail in ways traditional observability tools cannot detect.
            </h2>
            <p className="mt-5 max-w-3xl text-base leading-8 text-steel">
              A prompt update introduced hallucinated responses. Reliai detected the regression, opened an incident,
              explained the likely cause, and recommended a guardrail before users noticed.
            </p>
            <div className="mt-8">
              <ControlPanelPreview />
            </div>
          </div>
          <div className="space-y-6">
            <Card className="rounded-[30px] border-zinc-300 bg-white/90 p-6 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Failure timeline</p>
              <h3 className="mt-3 text-2xl font-semibold text-ink">
                failure → detection → explanation → mitigation
              </h3>
              <p className="mt-3 text-sm leading-7 text-steel">
                Most teams discover these issues only after users complain. Reliai catches them on the production path.
              </p>
            </Card>
            <FailureTimeline />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
          <Card className="rounded-[32px] border-zinc-300 p-8 lg:p-10">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Interactive demo</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-ink">
              Walk the operator workflow in under five minutes.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-steel">
              Start at system status, open the incident, inspect the trace graph, and finish at the mitigation point.
            </p>
            <div className="mt-6 grid gap-4">
              {demoFlow.map((item) => (
                <div key={item.step} className="rounded-[22px] border border-zinc-200 px-4 py-4">
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

          <div className="grid gap-6">
            {screenshots.map((item) => (
              <Card key={item.title} className="overflow-hidden rounded-[30px] border-zinc-300">
                <div className="border-b border-zinc-200 bg-white px-6 py-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-steel">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-steel">{item.body}</p>
                </div>
                <div className="bg-zinc-100 p-3">
                  <Image
                    src={item.src}
                    alt={item.title}
                    width={3200}
                    height={2000}
                    className="h-auto w-full rounded-[20px] border border-zinc-200"
                  />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
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
            <Card className="rounded-[28px] border-zinc-300 p-6">
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
              <div className="mt-6 rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
                <p className="text-sm leading-7 text-steel">
                  The playground is the fastest path to product understanding for engineers evaluating the control plane.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.28em] text-steel">The Reliai loop</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
            Reliai runs a continuous reliability loop around production AI systems.
          </h2>
        </div>
        <div className="mt-8 grid gap-3 lg:grid-cols-5">
          {reliabilityLoop.map((item, index) => (
            <Card key={item} className="rounded-[24px] border-zinc-300 px-5 py-5">
              <p className="text-xs uppercase tracking-[0.22em] text-steel">Step {index + 1}</p>
              <p className="mt-3 text-xl font-semibold text-ink">{item}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.28em] text-steel">Product overview</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              Four operator workflows from telemetry to protection.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {productPillars.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="rounded-[28px] border-zinc-300 p-6">
                  <Icon className="h-5 w-5 text-steel" />
                  <h3 className="mt-4 text-xl font-semibold text-ink">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-steel">{item.body}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <SdkInstallSection />

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)]">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-steel">Developer integration</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              Engineers can wire tracing into the live path immediately.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-steel">
              SDKs capture traces and pipeline spans across retrieval, prompt build, model execution, guardrails, and
              post-processing. This is production instrumentation, not a sample app toy.
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
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
            The control plane sits between the AI system and the production operator.
          </h2>
        </div>
        <div className="mt-8 flex flex-col items-center gap-4 lg:flex-row lg:justify-between">
          {[
            { label: "AI Application", icon: Bot },
            { label: "Reliai SDK", icon: Radar },
            { label: "Reliai Control Plane", icon: Workflow },
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

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <Card className="rounded-[32px] border-zinc-300 bg-[linear-gradient(180deg,#ffffff,#f5f6f8)] p-8 lg:p-10">
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
