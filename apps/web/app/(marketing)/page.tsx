import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  marketingContainerClass,
  marketingSectionClass,
  marketingSectionLargeClass,
} from "@/components/marketing/spatial-system";
import { Button } from "@/components/ui/button";

const workflowSections = [
  {
    label: "Detect",
    title: "Catch regressions as they land.",
    body: "Reliai turns trace deltas into incidents with a deterministic baseline, so operators see drift before users do.",
    image: "/screenshots/control-panel.png",
    alt: "Reliai control panel showing incident detection and reliability score",
  },
  {
    label: "Diagnose",
    title: "Read the trace like a debugger.",
    body: "Span timelines, retrieval failures, and guardrail retries are ordered for root-cause inspection—not for dashboards.",
    image: "/screenshots/trace-graph.png",
    alt: "Trace graph with retrieval failures and retry recovery",
  },
  {
    label: "Act",
    title: "Move from insight to action.",
    body: "Incidents surface a clear next step and the supporting evidence needed to execute with confidence.",
    image: "/screenshots/incident.png",
    alt: "Incident detail view showing operator action and evidence",
  },
];

export default function MarketingHomePage() {
  return (
    <main className="bg-[#f7f8fa] text-ink">
      <section className={`border-b border-zinc-200 ${marketingSectionLargeClass}`}>
        <div className={`${marketingContainerClass} grid gap-12 pb-16 pt-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center`}>
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-steel">AI debugging system</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink lg:text-5xl">
              Debug AI systems in minutes, not days.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-steel">
              Reliai gives operators a deterministic workflow for detecting regressions, isolating root cause, and taking action before users notice.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link href="/demo">
                  Run the demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/docs">Read the docs</Link>
              </Button>
            </div>
            <div className="mt-10 mb-12 border-t border-line pt-4">
              <p className="mb-3 text-xs uppercase tracking-[0.28em] text-textMuted">
                System performance
              </p>
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-textMuted">Incident detection</div>
                  <div className="text-2xl font-semibold text-textPrimary md:text-3xl">&lt; 30s</div>
                  <div className="mt-1 text-xs text-textSecondary">Time to first regression signal</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-textMuted">Root cause time</div>
                  <div className="text-2xl font-semibold text-textPrimary md:text-3xl">2m 14s</div>
                  <div className="mt-1 text-xs text-textSecondary">Mean time to isolate failure</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-textMuted">Traces analyzed</div>
                  <div className="text-2xl font-semibold text-textPrimary md:text-3xl">3.2M / day</div>
                  <div className="mt-1 text-xs text-textSecondary">Across production systems</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-textMuted">Detection rate</div>
                  <div className="text-2xl font-semibold text-textPrimary md:text-3xl">98.6%</div>
                  <div className="mt-1 text-xs text-textSecondary">Regression identification accuracy</div>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] text-steel">
              app.reliai.dev/control-panel
            </div>
            <div className="aspect-[16/10] overflow-hidden">
              <Image
                src="/screenshots/control-panel.png"
                alt="Reliai control panel showing live incident detection"
                width={3200}
                height={2000}
                className="h-full w-full object-cover object-top"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <section className={`${marketingSectionClass}`}>
        <div className={`${marketingContainerClass} mt-12 mb-14`}>
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.22em] text-textMuted">Example incident</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-textPrimary md:text-3xl">
              A regression appears after a deployment.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-textSecondary md:text-base">
              Reliai detects it, isolates the failure, and points the operator to the next step before
              users notice.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3 md:gap-6">
            <div className="rounded-2xl border border-line bg-white/80 p-5 md:p-6">
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Detect</p>
              <h3 className="mt-3 text-base font-semibold leading-snug text-textPrimary md:text-lg">
                Latency regression detected in 22s
              </h3>
              <p className="mt-2 text-sm leading-6 text-textSecondary">
                The baseline drifts immediately after rollout and incident creation begins without waiting
                for human triage.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-white/80 p-5 md:p-6">
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Diagnose</p>
              <h3 className="mt-3 text-base font-semibold leading-snug text-textPrimary md:text-lg">
                Retrieval identified as the failure point
              </h3>
              <p className="mt-2 text-sm leading-6 text-textSecondary">
                Trace analysis isolates the slow span, highlights the affected deployment, and shows the
                strongest root-cause signals.
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-white/80 p-5 md:p-6">
              <p className="text-[11px] uppercase tracking-[0.22em] text-textMuted">Act</p>
              <h3 className="mt-3 text-base font-semibold leading-snug text-textPrimary md:text-lg">
                Operator receives a clear next step
              </h3>
              <p className="mt-2 text-sm leading-6 text-textSecondary">
                Reliai recommends reviewing supporting traces and recent changes before rollback or
                mitigation.
              </p>
            </div>
          </div>

          <p className="mt-5 text-sm text-textSecondary">Resolution path established in under 3 minutes.</p>
        </div>
      </section>

      <section className={`border-b border-zinc-200 ${marketingSectionClass}`}>
        <div className={`${marketingContainerClass} space-y-14`}>
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.28em] text-steel">Workflow</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              Detect. Diagnose. Act.
            </h2>
            <p className="mt-4 text-sm leading-6 text-steel">
              Every screen is built for operators who need to answer: what broke, where, and why—fast.
            </p>
          </div>

          <div className="space-y-10">
            {workflowSections.map((section, index) => (
              <div
                key={section.label}
                className={`grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center ${
                  index % 2 === 1 ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" : ""
                }`}
              >
                <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                  <p className="text-xs uppercase tracking-[0.28em] text-steel">{section.label}</p>
                  <h3 className="mt-3 text-2xl font-semibold text-ink">{section.title}</h3>
                  <p className="mt-4 text-sm leading-6 text-steel">{section.body}</p>
                </div>
                <div className={index % 2 === 1 ? "lg:order-1" : ""}>
                  <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                    <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] text-steel">
                      app.reliai.dev/{section.label.toLowerCase()}
                    </div>
                    <div className="aspect-[16/9] overflow-hidden">
                      <Image
                        src={section.image}
                        alt={section.alt}
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

      <section className={`${marketingSectionClass}`}>
        <div className={`${marketingContainerClass} flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between`}>
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.28em] text-steel">Operator-grade</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              Built for real incident response.
            </h2>
            <p className="mt-4 text-sm leading-6 text-steel">
              Reliai pairs trace-level context with deterministic regression signals so teams can act with confidence.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/demo">Run the demo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
