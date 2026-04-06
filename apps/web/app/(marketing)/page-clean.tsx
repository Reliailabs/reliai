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
    urlSlug: "deployments",
    title: "Risk surfaces before a single user is affected.",
    body: "Every deployment runs through the Reliai safety gate — scoring retrieval regression probability, guardrail gaps, and cross-organization failure patterns. A WARNING or BLOCK decision surfaces before rollout with a specific risk score and the exact factors driving it, so you catch issues before they reach production.",
    image: "/screenshots/deployment.png",
    alt: "Deployment safety gate showing WARNING decision with risk score and regression factors",
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
    label: "Act",
    urlSlug: "incidents",
    title: "From signal to action — no log diving required.",
    body: "The reliability control panel surfaces what needs attention next: active incidents, deployment risk, guardrail coverage, and specific operator guidance. When something degrades, the exact prompt version, retrieval failure, or guardrail gap is already surfaced. You go from alert to fix without writing a single query.",
    image: "/screenshots/control-panel.png",
    alt: "Reliability control panel showing active incidents, risk score, and operator guidance",
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
    <main className="bg-page text-primary">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={`border-b border-zinc-200 ${marketingSectionLargeClass}`}>
        <div className={`${marketingContainerClass} flex flex-col items-center pb-16 pt-24 text-center`} data-marketing-container>
          {/* Headline + CTAs */}
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-primary lg:text-5xl">
            Find and fix AI failures before your users do.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-secondary">
            Reliai turns regressions into incidents, shows you what changed, and proves the fix worked.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link href="/onboarding?path=simulation">
                Run the 2-minute simulation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/demo">View demo</Link>
            </Button>
          </div>
          {/* Hero visual */}
          <div className="mt-12 w-full max-w-2xl">
            <HeroAnnotatedVisual />
          </div>
        </div>
      </section>
      {/* ...existing code... */}
    </main>
  );
}
