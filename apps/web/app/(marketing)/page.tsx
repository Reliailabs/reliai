import Image from "next/image";
import Link from "next/link";
import { ArrowRight, AlertTriangle, FileCode2, Layers, Timer, GitBranch, Wrench } from "lucide-react";

import { HeroAnnotatedVisual } from "@/components/marketing/hero-annotated-visual";
import {
  marketingContainerClass,
  marketingSectionClass,
  marketingSectionLargeClass,
} from "@/components/marketing/spatial-system";
import { Button } from "@/components/ui/button";

// ─── Data ────────────────────────────────────────────────────────────────────

const workflowSteps = [
  {
    label: "Detect",
    urlSlug: "incidents",
    title: "An incident opens before anyone files a ticket.",
    body: "Reliai evaluates every trace against behavioral signals — refusal patterns, custom metrics, structured output validity, latency, cost. When behavior changes beyond baseline, Reliai opens an incident automatically. One incident per fingerprint; recurring regressions reopen the same incident rather than creating noise.",
    image: "/screenshots/control-panel.png",
    alt: "Reliai control panel showing an open refusal rate incident",
  },
  {
    label: "Compare",
    urlSlug: "compare",
    title: "Current window vs. baseline, assembled for you.",
    body: "The cohort diff is pre-built from the incident window — current traces vs. baseline traces, side by side. Every dimension that changed is flagged: prompt version, model name, refusal signal, output validity, latency, cost. No query to write.",
    image: "/screenshots/trace-graph.png",
    alt: "Cohort diff view showing current versus baseline trace comparison",
  },
  {
    label: "Root cause",
    urlSlug: "root-cause",
    title: "Six causes scored. One recommendation surfaced.",
    body: "The command center scores prompt version shift, model shift, latency change, retrieval shift, deployment risk, and error cluster dominance — then surfaces the highest-probability cause with a specific fix. Deterministic scoring, no LLM dependency, sub-second result.",
    image: "/screenshots/incident.png",
    alt: "Incident command center showing root cause analysis and fix recommendation",
  },
];

const signals = [
  {
    label: "LLM safety drift",
    name: "Refusal detection",
    description:
      "Pattern-matches every trace output against evasion signals. When refusal rate spikes above threshold — 15% absolute, 50% relative — an incident opens at critical or high severity. The command center shows baseline vs. current rate and the contributing prompt version.",
  },
  {
    label: "Policy violations",
    name: "Custom metrics",
    description:
      "Define what bad output means for your system. Regex pattern or keyword list. Match as boolean or count. When your metric spikes above threshold, Reliai opens an incident the same way it does for built-in signals.",
  },
  {
    label: "Contract breakage",
    name: "Structured output failures",
    description:
      "If your AI is expected to return JSON, Reliai validates it on every trace. A drop in validity rate — even with no 5xx errors — opens an incident. No custom instrumentation required.",
  },
];

const failures = [
  {
    icon: AlertTriangle,
    type: "Refusal spike",
    what: "Your model started refusing valid requests after a prompt update.",
    how: "Reliai measures refusal rate per trace window. When it crosses 15% absolute or doubles from baseline, a critical incident opens automatically.",
  },
  {
    icon: GitBranch,
    type: "Prompt regression",
    what: "A prompt change shipped and behavior degraded — but all 200s, no alarms.",
    how: "Reliai compares current traces to the pre-rollout baseline and flags the prompt version responsible.",
  },
  {
    icon: FileCode2,
    type: "Output contract break",
    what: "Your downstream system started receiving malformed JSON. Silently.",
    how: "Reliai validates structured output on every trace. A drop in validity rate opens an incident even when HTTP status is 200.",
  },
  {
    icon: Timer,
    type: "Latency degradation",
    what: "Response times doubled after a model migration. Users noticed before the team did.",
    how: "Reliai tracks per-trace latency against the deployment baseline and surfaces the shift as a regression.",
  },
  {
    icon: Layers,
    type: "Retrieval drift",
    what: "Your RAG pipeline started pulling off-topic chunks. Quality degraded gradually.",
    how: "Reliai's behavioral signals include custom retrieval quality metrics — you define the threshold, Reliai opens the incident.",
  },
  {
    icon: Wrench,
    type: "Tool misuse",
    what: "An agent started calling the wrong tool, or calling it with bad arguments, at scale.",
    how: "Instrument tool call outcomes as a custom metric. Reliai detects the spike and opens an incident with the affected trace cluster.",
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MarketingHomePage() {
  return (
    <main className="bg-[#f7f8fa] text-ink" data-marketing-container>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={`border-b border-zinc-200 ${marketingSectionLargeClass}`}>
        <div className={`${marketingContainerClass} grid gap-12 pb-16 pt-24 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start`}>

          {/* Left column */}
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-steel">AI incident response</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink lg:text-5xl">
              When your AI breaks in production, Reliai tells you what broke, why, and what to fix.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-steel">
              Reliai detects behavioral regressions — refusals, output failures, metric spikes — opens incidents automatically, and walks your team through root cause to resolution.
            </p>
            <p className="mt-3 text-sm font-medium text-textSecondary">
              Not logs. Not dashboards. Real incidents with root cause and resolution — built for AI.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link href="/onboarding?path=simulation">
                  See your first incident in under 2 minutes
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/demo">View live demo</Link>
              </Button>
            </div>

            {/* Proof stats */}
            <div className="mt-10 mb-12 border-t border-line pt-6">
              <p className="mb-4 text-xs uppercase tracking-[0.28em] text-textMuted">
                What Reliai detects
              </p>
              <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-textMuted">Refusal spikes</div>
                  <div className="text-2xl font-semibold text-textPrimary md:text-3xl">Built-in</div>
                  <div className="mt-1 text-xs text-textSecondary">Pattern-matched on every trace</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-textMuted">Custom signals</div>
                  <div className="text-2xl font-semibold text-textPrimary md:text-3xl">Operator-defined</div>
                  <div className="mt-1 text-xs text-textSecondary">Regex or keyword, your rules</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-textMuted">Root cause</div>
                  <div className="text-2xl font-semibold text-textPrimary md:text-3xl">6 causes scored</div>
                  <div className="mt-1 text-xs text-textSecondary">Prompt, model, latency, retrieval, deployment, errors</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column — annotated hero visual */}
          <HeroAnnotatedVisual />

        </div>
      </section>

      {/* ── Compatibility strip ───────────────────────────────────────────── */}
      <section className="border-b border-zinc-200 bg-white py-5">
        <div className={`${marketingContainerClass} flex flex-wrap items-center justify-between gap-4`}>
          <p className="text-xs uppercase tracking-[0.28em] text-textMuted">Works with</p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            {["OpenAI", "Anthropic", "LangChain", "LlamaIndex", "Custom pipelines"].map((name) => (
              <span key={name} className="text-sm font-medium text-textSecondary">{name}</span>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span className="text-xs font-medium text-textSecondary">First incident detected in under 30 seconds</span>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className={`border-b border-zinc-200 ${marketingSectionClass}`}>
        <div className={`${marketingContainerClass} space-y-14`}>
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.28em] text-steel">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              From failure to fix — without manual triage.
            </h2>
            <p className="mt-4 text-sm leading-6 text-steel">
              Observability tells you something changed. Reliai tells you what broke and why.
            </p>
          </div>

          <div className="space-y-10">
            {workflowSteps.map((step, index) => (
              <div
                key={step.label}
                className={`grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center ${
                  index % 2 === 1 ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" : ""
                }`}
              >
                <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                  <p className="text-xs uppercase tracking-[0.28em] text-steel">{step.label}</p>
                  <h3 className="mt-3 text-2xl font-semibold text-ink">{step.title}</h3>
                  <p className="mt-4 text-sm leading-6 text-steel">{step.body}</p>
                </div>
                <div className={index % 2 === 1 ? "lg:order-1" : ""}>
                  <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] text-steel">
                      app.reliai.dev/{step.urlSlug}
                    </div>
                    <div className="aspect-[16/9] overflow-hidden">
                      <Image
                        src={step.image}
                        alt={step.alt}
                        width={3200}
                        height={2000}
                        className="h-full w-full object-cover object-top"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Common failures strip ─────────────────────────────────────────── */}
      <section className={`border-b border-zinc-200 ${marketingSectionClass}`}>
        <div className={`${marketingContainerClass}`}>
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.28em] text-steel">Failure coverage</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              Recognize any of these?
            </h2>
            <p className="mt-4 text-sm leading-6 text-steel">
              These are the failures teams discover late — hours into a user-facing incident, long after the signal was detectable. Reliai catches each one as it happens.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {failures.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.type} className="rounded-2xl border border-line bg-white p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
                      <Icon className="h-4 w-4 text-textSecondary" />
                    </div>
                    <p className="text-sm font-semibold text-textPrimary">{f.type}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-textSecondary">{f.what}</p>
                  <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-textMuted">What Reliai does</p>
                    <p className="mt-1 text-xs leading-5 text-textSecondary">{f.how}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Behavioral signals ───────────────────────────────────────────── */}
      <section className={`border-b border-zinc-200 ${marketingSectionClass}`}>
        <div className={`${marketingContainerClass}`}>
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.28em] text-steel">Behavioral signals</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              The signals that actually break AI systems.
            </h2>
            <p className="mt-4 text-sm leading-6 text-steel">
              Standard monitoring tells you a request succeeded. Reliai tells you whether the response was actually correct. These are not the same thing — and the gap is where production AI fails silently.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3 md:gap-6">
            {signals.map((signal) => (
              <div key={signal.name} className="rounded-2xl border border-line bg-white/80 p-5 md:p-6">
                <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">{signal.label}</p>
                <h3 className="mt-2 text-base font-semibold leading-snug text-textPrimary">
                  {signal.name}
                </h3>
                <p className="mt-3 text-sm leading-6 text-textSecondary">{signal.description}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm text-textSecondary">
            Evals test before you deploy. Reliai catches what evals miss — in production, in real traffic, in real time.
          </p>
        </div>
      </section>

      {/* ── Differentiation ──────────────────────────────────────────────── */}
      <section className={`border-b border-zinc-200 ${marketingSectionClass}`}>
        <div className={`${marketingContainerClass}`}>
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.28em] text-steel">Positioning</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              Not observability. Not evals. Incident response.
            </h2>
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.22em] text-textMuted">
                  <th className="pb-3 pr-6 font-medium">Tool</th>
                  <th className="pb-3 pr-6 font-medium">What it does</th>
                  <th className="pb-3 font-medium">What&rsquo;s missing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="py-4 pr-6 font-medium text-textPrimary">Langfuse, LangSmith</td>
                  <td className="py-4 pr-6 text-textSecondary">Logs traces. Shows you what happened.</td>
                  <td className="py-4 text-textSecondary">No incidents. No root cause.</td>
                </tr>
                <tr>
                  <td className="py-4 pr-6 font-medium text-textPrimary">Arize, Fiddler</td>
                  <td className="py-4 pr-6 text-textSecondary">ML observability dashboards. Charts that drift.</td>
                  <td className="py-4 text-textSecondary">Not designed for LLM behavioral signals. No incident lifecycle.</td>
                </tr>
                <tr>
                  <td className="py-4 pr-6 font-medium text-textPrimary">Custom dashboards</td>
                  <td className="py-4 pr-6 text-textSecondary">You build the queries. You set the thresholds.</td>
                  <td className="py-4 text-textSecondary">Ongoing maintenance. No root cause. No workflow.</td>
                </tr>
                <tr className="bg-white/60">
                  <td className="py-4 pr-6 font-semibold text-textPrimary">Reliai</td>
                  <td className="py-4 pr-6 text-textSecondary">Opens incidents when behavior degrades. Walks you from failure to root cause to fix.</td>
                  <td className="py-4 text-textSecondary">—</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-sm text-textSecondary">
            If you&rsquo;re debugging AI with logs, you&rsquo;re already too late. Reliai turns failures into incidents before they become user-facing problems.
          </p>
        </div>
      </section>

      {/* ── Demo / aha moment ────────────────────────────────────────────── */}
      <section className={`border-b border-zinc-200 ${marketingSectionClass}`}>
        <div className={`${marketingContainerClass} grid gap-10 lg:grid-cols-2 lg:items-center`}>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-steel">See it live</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              See it break. Understand why. In under two minutes.
            </h2>
            <p className="mt-4 text-sm leading-6 text-steel">
              The demo runs a full incident scenario — no API key, no setup. Reliai generates synthetic traces with a clean baseline followed by a hallucination spike, opens a real incident, and walks you through the command center, trace graph, and root cause exactly as an operator would.
            </p>
            <ol className="mt-6 space-y-3 text-sm leading-6 text-steel">
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-600">1</span>
                Synthetic traces ingested — clean baseline, then hallucination spike window
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-600">2</span>
                Incident auto-opens — reliability score drops, active incident surfaces in control panel
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-600">3</span>
                Root cause: prompt update deployed 82 minutes before incident start — evidence linked automatically
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-600">4</span>
                Trace graph, cohort diff, and deployment safety gate — full operator workflow, no steps skipped
              </li>
            </ol>
            <p className="mt-6 text-sm font-medium text-textPrimary">
              In under 2 minutes, you go from &ldquo;something broke&rdquo; to &ldquo;we know exactly what to fix.&rdquo;
            </p>
            <div className="mt-6">
              <Button asChild>
                <Link href="/demo">
                  Run the demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] text-steel">
              app.reliai.dev/incidents/command
            </div>
            <div className="aspect-[16/10] overflow-hidden">
              <Image
                src="/screenshots/incident.png"
                alt="Incident command center showing root cause analysis for a hallucination spike"
                width={3200}
                height={2000}
                className="h-full w-full object-cover object-top"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className={`${marketingSectionClass} bg-zinc-900`}>
        <div className={`${marketingContainerClass} flex flex-col items-center text-center gap-6`}>
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Get started</p>
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-white lg:text-4xl">
            Your AI is already in production.<br className="hidden lg:block" /> Is anyone watching it?
          </h2>
          <p className="max-w-xl text-sm leading-6 text-zinc-400">
            Reliai is the incident response layer for AI systems — the step between &ldquo;something degraded&rdquo; and &ldquo;we know what to fix.&rdquo;
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-white text-zinc-900 hover:bg-zinc-100">
              <Link href="/demo">
                Run the demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
          <p className="text-xs text-zinc-600">No credit card. No setup. See your first incident in under 2 minutes.</p>
        </div>
      </section>

    </main>
  );
}
