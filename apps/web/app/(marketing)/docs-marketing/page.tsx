import Link from "next/link";
import type { Route } from "next";

import {
  marketingCardClass,
  marketingContainerClass,
  marketingSectionClass,
  marketingSectionLargeClass,
} from "@/components/marketing/spatial-system";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const workflowSteps = [
  {
    label: "Detect",
    body: "Identify regressions through metrics and trace patterns.",
  },
  {
    label: "Understand",
    body: "Analyze root cause using trace comparison and evidence.",
  },
  {
    label: "Fix",
    body: "Apply changes based on system recommendations and inspection.",
  },
  {
    label: "Prove",
    body: "Verify improvement using resolution impact.",
  },
  {
    label: "Share",
    body: "Export context via ticket drafts and fix summaries.",
  },
];

const systemAreas = [
  {
    title: "Instrumentation",
    body: "Capture traces across your AI system — requests and responses, retrieval and tool calls, guardrail and policy events.",
  },
  {
    title: "Operator workflows",
    body: "Investigate incidents, compare traces, review root cause analysis, and validate fixes using the command center.",
  },
  {
    title: "Governance and runtime protection",
    body: "Apply guardrail policies, monitor compliance checks, and get mitigation guidance for production paths.",
  },
];

const aiDoes = [
  "Summarize incidents",
  "Explain root cause evidence",
  "Draft tickets and summaries",
];

const aiDoesNot = [
  "Generate traces",
  "Determine root cause",
  "Trigger actions",
  "Modify system data",
];

const limits = [
  { label: "Sampling active", note: "some traces are not stored" },
  { label: "Rate limited", note: "some data may be delayed or dropped" },
  { label: "Processing delayed", note: "analysis is queued" },
  { label: "Payload truncated", note: "some fields are incomplete" },
];

const startHere = [
  { label: "Incident workflow", href: "/demo", note: "debug issues step by step" },
  { label: "Core concepts", href: "/docs", note: "traces, incidents, and evidence" },
  { label: "AI guide", href: "/docs", note: "how to use AI safely in Reliai" },
] satisfies { label: string; href: Route; note: string }[];

export default function DocsPage() {
  return (
    <main className={`${marketingContainerClass} ${marketingSectionLargeClass} pb-24`}>
      {/* Header */}
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.28em] text-steel">Docs</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-ink">
          Understand, debug, and operate AI systems in production.
        </h1>
        <p className="mt-6 text-base leading-8 text-steel">
          Reliai helps teams detect, investigate, and resolve AI system issues using real-time
          telemetry, deterministic root cause analysis, and AI-assisted workflows. These docs are
          designed for operators and engineers working with production AI systems.
        </p>
        <p className="mt-3 text-sm italic text-steel">
          Reliai never replaces system truth with AI — it helps you understand it faster.
        </p>
      </div>

      {/* Core Workflow */}
      <section className={marketingSectionClass}>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">How Reliai works</h2>
        <p className="mt-2 text-sm text-steel">Reliai is built around a single operational loop.</p>
        <div className="mt-6 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
          {workflowSteps.map((step, i) => (
            <div key={step.label} className="flex items-start gap-4 px-6 py-4">
              <span className="mt-0.5 w-5 font-mono text-xs tabular-nums text-steel">{i + 1}</span>
              <div>
                <span className="text-sm font-semibold text-ink">{step.label}</span>
                <span className="ml-2 text-sm text-steel">{step.body}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* System Areas */}
      <section className={marketingSectionClass}>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">System areas</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {systemAreas.map((area) => (
            <Card key={area.title} className={marketingCardClass}>
              <h3 className="text-base font-semibold text-ink">{area.title}</h3>
              <p className="mt-3 text-sm leading-7 text-steel">{area.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* AI in Reliai */}
      <section className={marketingSectionClass}>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">AI in Reliai</h2>
        <p className="mt-2 text-sm text-steel">
          Reliai uses AI to assist operators — not replace them.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card className={marketingCardClass}>
            <h3 className="text-sm font-semibold text-ink">AI is used for</h3>
            <ul className="mt-3 space-y-2">
              {aiDoes.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-steel">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
          <Card className={marketingCardClass}>
            <h3 className="text-sm font-semibold text-ink">AI is NOT used for</h3>
            <ul className="mt-3 space-y-2">
              {aiDoesNot.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-steel">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* Limits */}
      <section className={marketingSectionClass}>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          Limits &amp; partial data
        </h2>
        <p className="mt-2 text-sm text-steel">
          Reliai surfaces system limits clearly. You may see:
        </p>
        <div className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
          {limits.map((l) => (
            <div key={l.label} className="flex items-center gap-3 px-6 py-3">
              <span className="text-sm font-medium text-ink">{l.label}</span>
              <span className="text-xs text-steel">— {l.note}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-steel">
          These states are surfaced in the global banner and inline indicators.
        </p>
      </section>

      {/* Start Here */}
      <section className={marketingSectionClass}>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Start here</h2>
        <ul className="mt-4 space-y-2">
          {startHere.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="text-sm font-medium text-ink underline-offset-4 hover:underline"
              >
                {item.label}
              </Link>
              <span className="ml-2 text-xs text-steel">— {item.note}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex gap-3">
          <Button asChild>
            <Link href="/demo">View Demo</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/signup">Get Started</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
