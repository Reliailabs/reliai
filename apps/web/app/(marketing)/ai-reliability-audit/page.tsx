import type { Metadata } from "next";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  LineChart,
  Radar,
  ShieldCheck,
  Signal,
  Wrench,
} from "lucide-react";

import {
  marketingCardClass,
  marketingContainerClass,
  marketingMetricClass,
  marketingSectionClass,
  marketingSectionLargeClass,
} from "@/components/marketing/spatial-system";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "AI Reliability Audit | Reliai",
  description:
    "Find and fix hidden failures in your AI system in 7 days. Reliai identifies failure modes, adds guardrails, and helps prevent user-facing AI incidents.",
};

const CTA_HREF = "mailto:hello@reliai.dev";

const risks = [
  {
    title: "Silent failures",
    description: "Errors that never throw, but quietly degrade outcomes and customer experience.",
    impact: "Impact: Erodes trust without triggering obvious alerts.",
    icon: AlertTriangle,
  },
  {
    title: "Hallucinations",
    description: "False answers or invented facts that make it into production responses.",
    impact: "Impact: Creates costly rework and escalations downstream.",
    icon: Radar,
  },
  {
    title: "Broken automations",
    description: "Tool calls fail, retries loop, and workflows stall without clear visibility.",
    impact: "Impact: Missed SLAs and manual recovery drain engineering time.",
    icon: Wrench,
  },
  {
    title: "Undetected regressions",
    description: "Model or prompt changes shift behavior without obvious warnings.",
    impact: "Impact: Quality drops before anyone can tie it to a change.",
    icon: LineChart,
  },
  {
    title: "Prompt + model drift",
    description: "Small changes compound until the system behaves differently than expected.",
    impact: "Impact: Gradual degradation that chips away at product reliability.",
    icon: Signal,
  },
];

const deliverables = [
  {
    title: "Full trace visibility across critical LLM workflows",
    benefit: "No more digging through logs to find a single failure.",
  },
  {
    title: "3–5 documented failure modes with evidence",
    benefit: "Know exactly where your system breaks and why.",
  },
  {
    title: "Guardrails deployed on critical paths",
    benefit: "Reduce repeat incidents without constant monitoring.",
  },
  {
    title: "Alerts configured for future reliability issues",
    benefit: "Catch regressions before customers report them.",
  },
  {
    title: "Incident replay showing how failure propagates",
    benefit: "See the exact path from trace to user impact.",
  },
];

const steps = [
  {
    title: "Instrument",
    body: "Instrument your AI workflows so the critical paths, handoffs, and failure surfaces are visible.",
    icon: Activity,
  },
  {
    title: "Analyze",
    body: "Review real traces to identify concrete failure modes and understand where risk is accumulating.",
    icon: Radar,
  },
  {
    title: "Harden",
    body: "Implement guardrails and alerts to reduce the risk of user-facing AI incidents.",
    icon: ShieldCheck,
  },
];

export default function AiReliabilityAuditPage() {
  return (
    <main className="bg-page text-primary">
      <section className={`border-b border-zinc-200 ${marketingSectionLargeClass}`}>
        <div className={`${marketingContainerClass} grid gap-12 pb-16 pt-20 lg:grid-cols-[1.1fr_0.9fr]`}>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-secondary">AI Reliability Audit</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-primary md:text-5xl">
              Find and Fix Hidden Failures in Your AI System in 7 Days
            </h1>
            <p className="mt-6 text-base leading-7 text-secondary">
              We instrument your production LLM workflows, analyze real traces, and identify 3–5 concrete failure modes
              like hallucinations, regressions, and silent breakdowns. Then we implement guardrails and alerts to reduce
              the risk of user-facing AI incidents.
            </p>
            <div className="mt-4">
              <p className="text-sm text-secondary">For teams already running LLMs in production.</p>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg">
                {/* TODO: Replace with scheduling link once a booking flow exists. */}
                <a href={CTA_HREF}>
                  Book a 20-minute call
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <p className="text-xs uppercase tracking-[0.32em] text-secondary">Powered by early Reliai infrastructure</p>
            </div>
            <div className="mt-6 rounded-2xl border border-accent/30 bg-white px-5 py-4 text-sm font-medium text-primary shadow-sm">
              If we don’t find at least 3 real issues or meaningful risks, you don’t pay.
            </div>
          </div>

          <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <p className="text-xs uppercase tracking-[0.32em] text-secondary">Engagement snapshot</p>
            <div className="mt-6 space-y-6">
              <div>
                <p className={`text-4xl text-primary ${marketingMetricClass}`}>7 days</p>
                <p className="mt-2 text-sm text-secondary">Instrument, analyze, and harden your system.</p>
              </div>
              <div>
                <p className={`text-3xl text-primary ${marketingMetricClass}`}>3–5 failure modes</p>
                <p className="mt-2 text-sm text-secondary">Documented issues with evidence, impact, and remediation paths.</p>
              </div>
              <div>
                <p className={`text-3xl text-primary ${marketingMetricClass}`}>Guardrails live</p>
                <p className="mt-2 text-sm text-secondary">Validation, retries, and alerts in place before handoff.</p>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-code bg-code px-5 py-4 text-xs text-code shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)]">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.28em] text-zinc-400">
                <span>Trace replay</span>
                <span className="text-emerald-300">live evidence</span>
              </div>
              <div className="mt-4 space-y-2 font-mono text-[11px] leading-5">
                <div className="text-zinc-400">trace_id=4938a env=prod service=assistant</div>
                <div>
                  <span className="text-sky-300">llm_call</span>
                  <span className="text-zinc-500"> → </span>
                  <span className="text-zinc-200">parse_output</span>
                </div>
                <div>
                  <span className="text-rose-300">error</span>
                  <span className="text-zinc-500">: </span>
                  <span className="text-zinc-200">invalid_json</span>
                </div>
                <div>
                  <span className="text-amber-300">retry</span>
                  <span className="text-zinc-500"> → </span>
                  <span className="text-emerald-300">success</span>
                </div>
                <div>
                  <span className="text-purple-300">guardrail</span>
                  <span className="text-zinc-500">: </span>
                  <span className="text-zinc-200">triggered</span>
                </div>
                <div className="text-zinc-400">alert=incident_opened severity=critical</div>
              </div>
            </div>
            <div className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-xs text-secondary">
              Designed for CTOs, Heads of AI, and engineering teams already shipping LLM-powered workflows.
            </div>
          </div>
        </div>
      </section>

      <section className={`${marketingContainerClass} ${marketingSectionClass}`}>
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.36em] text-secondary">The risk</p>
            <h2 className="mt-4 text-3xl font-semibold text-primary">
              Hidden failures stay invisible until customers feel them.
            </h2>
            <p className="mt-4 text-sm leading-7 text-secondary">
              Production LLM systems often fail in ways that never surface as obvious errors. This audit isolates the
              exact failure surfaces before they become user-facing incidents.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {risks.map((risk) => (
              <div key={risk.title} className={marketingCardClass}>
                <risk.icon className="h-5 w-5 text-accent" />
                <h3 className="mt-4 text-lg font-semibold text-primary">{risk.title}</h3>
                <p className="mt-2 text-sm leading-6 text-secondary">{risk.description}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-secondary">{risk.impact}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8">
          <Button asChild size="lg" variant="outline">
            <a href={CTA_HREF}>Audit my system for these failures</a>
          </Button>
        </div>
      </section>

      <section className={`${marketingContainerClass} ${marketingSectionClass}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.36em] text-secondary">What you get</p>
            <h2 className="mt-4 text-3xl font-semibold text-primary">A reliability upgrade, delivered in one week.</h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-secondary">
            Every deliverable is concrete, documented, and tied to real traces from your production system.
          </p>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {deliverables.map((item) => (
            <div key={item.title} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-2">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent" />
                <div>
                  <p className="text-sm font-semibold text-primary">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-secondary">{item.benefit}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm font-semibold text-primary">
          This is not a report. It’s a working system with guardrails in place.
        </p>
      </section>

      <section className={`${marketingContainerClass} ${marketingSectionClass}`}>
        <div className="rounded-[28px] border border-zinc-200 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.36em] text-secondary">How it works</p>
              <h2 className="mt-4 text-3xl font-semibold text-primary">Instrument. Analyze. Harden.</h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-secondary">
              A focused 3-step engagement designed to surface risk quickly and harden what matters most.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.32em] text-secondary">
                  <span>Step {index + 1}</span>
                  <step.icon className="h-4 w-4 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-primary">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-secondary">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${marketingContainerClass} ${marketingSectionClass}`}>
        <div className="rounded-[28px] border border-accent/40 bg-white px-8 py-10 shadow-[0_20px_60px_rgba(185,28,28,0.12)]">
          <p className="text-xs uppercase tracking-[0.36em] text-secondary">Guarantee</p>
          <h2 className="mt-4 text-3xl font-semibold text-primary">If we do not find meaningful issues, you do not pay.</h2>
          <p className="mt-3 text-sm leading-7 text-secondary">
            If we do not find at least 3 real issues or meaningful risks, you do not pay.
          </p>
        </div>
      </section>

      <section className={`${marketingContainerClass} ${marketingSectionClass}`}>
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[24px] border border-zinc-200 bg-white p-8 shadow-sm">
            <p className="text-xs uppercase tracking-[0.36em] text-secondary">Pricing</p>
            <h2 className="mt-4 text-3xl font-semibold text-primary">Typical engagement: $8k–$12k</h2>
            <p className="mt-4 text-sm leading-7 text-secondary">
              Fixed-scope audit focused on immediate reliability outcomes, with documented findings, guardrails, and
              alerts.
            </p>
            <p className="mt-3 text-sm text-secondary">
              Includes full failure analysis, guardrail implementation, and incident replay.
            </p>
          </div>
          <div className="rounded-[24px] border border-accent/40 bg-zinc-50 p-8 shadow-[0_18px_40px_rgba(185,28,28,0.12)]">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-secondary">
              <span>Design partners</span>
              <span className="rounded-full border border-accent/30 px-2 py-1 text-[10px] text-accent">
                Limited availability
              </span>
            </div>
            <h3 className="mt-4 text-2xl font-semibold text-primary">Limited early-stage slots at $5k</h3>
            <p className="mt-4 text-sm leading-7 text-secondary">
              Same audit, same depth. Limited design partner slots available for teams willing to move quickly and
              provide tight feedback during rollout.
            </p>
          </div>
        </div>
        <div className="mt-8">
          <Button asChild size="lg">
            <a href={CTA_HREF}>Check design partner availability</a>
          </Button>
        </div>
      </section>

      <section className={`${marketingContainerClass} ${marketingSectionClass} pb-24`}>
        <div className="rounded-[28px] border border-zinc-200 bg-white px-8 py-12 shadow-[0_26px_70px_rgba(15,23,42,0.1)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.36em] text-secondary">Ready for a reliability reset?</p>
              <h2 className="mt-4 text-3xl font-semibold text-primary">Book a 20-minute call to scope the audit.</h2>
              <p className="mt-3 text-sm leading-7 text-secondary">
                We’ll confirm fit, scope the audit, and map the fastest path to a 7-day engagement.
              </p>
            </div>
            <Button asChild size="lg">
              {/* TODO: Replace with scheduling link once a booking flow exists. */}
              <a href={CTA_HREF}>
                Check design partner availability
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
