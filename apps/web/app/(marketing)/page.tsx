import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  marketingContainerClass,
  marketingSectionClass,
  marketingSectionLargeClass,
} from "@/components/marketing/spatial-system";
import { Button } from "@/components/ui/button";

const capabilitySections = [
  {
    title: "Detect failures early",
    points: ["Regression detections", "Failed evals", "High-risk outputs"],
    description:
      "Reliai continuously tracks AI behavior and surfaces reliability regressions before they become customer-visible incidents.",
  },
  {
    title: "Investigate incidents",
    points: ["Incident grouping", "Trace-level visibility", "Root cause context"],
    description:
      "When reliability degrades, Reliai groups signals into incidents and links each incident to the traces and failure patterns driving it.",
  },
  {
    title: "Understand what changed",
    points: ["Reliability timeline", "Deployment correlation", "Drift detection"],
    description:
      "Pulse highlights recent changes so teams can connect deployments, model behavior shifts, and regressions in one operational view.",
  },
  {
    title: "Take action",
    points: ["Recommended actions", "Guardrails and controls", "Audit readiness"],
    description:
      "Pulse converts reliability signals into clear next steps, with guardrail posture and certification readiness visible in the same workflow.",
  },
];

const areiBreakdown = [
  "Failure risk",
  "Incident risk",
  "Drift risk",
  "Guardrail risk",
  "Audit readiness gap",
  "Production criticality",
];

export default function MarketingHomePage() {
  return (
    <main className="bg-page text-primary">
      <section className={`border-b border-zinc-200 ${marketingSectionLargeClass}`}>
        <div
          className={`${marketingContainerClass} grid gap-10 pb-16 pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center`}
          data-marketing-container
        >
          <div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-primary lg:text-5xl">
              Know when your AI is failing before your customers do.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-secondary">
              Reliai monitors AI agents, RAG systems, and model behavior to detect regressions, surface incidents,
              and prove reliability in production.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link href="/ai-reliability-audit">
                  Run reliability audit
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-zinc-300 text-ink hover:bg-zinc-50">
                <Link href="/demo">View Pulse dashboard</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">Pulse dashboard preview</p>
              <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] text-secondary">AREI · Incidents · Actions</span>
            </div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-b-2xl">
              <Image
                src="/screenshots/control-panel.png"
                alt="Pulse dashboard showing reliability risk, open incidents, and recommended actions"
                fill
                sizes="(max-width: 1200px) 100vw, 720px"
                className="object-cover object-top"
              />
            </div>
          </div>
        </div>
      </section>

      <section className={`border-b border-zinc-200 ${marketingSectionClass}`}>
        <div className={`${marketingContainerClass} space-y-6`}>
          <h2 className="text-3xl font-semibold tracking-tight text-primary">Pulse capabilities in production</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {capabilitySections.map((section) => (
              <div key={section.title} className="rounded-2xl border border-zinc-200 bg-white p-5">
                <h3 className="text-xl font-semibold text-primary">{section.title}</h3>
                <p className="mt-3 text-sm leading-6 text-secondary">{section.description}</p>
                <ul className="mt-4 space-y-2 text-sm text-secondary">
                  {section.points.map((point) => (
                    <li key={point} className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`border-b border-zinc-200 ${marketingSectionClass}`}>
        <div className={`${marketingContainerClass} grid gap-8 lg:grid-cols-[1fr_1fr]`}>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Core signal</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-primary">AI Reliability Exposure Index (AREI)</h2>
            <p className="mt-4 text-sm leading-6 text-secondary">
              AREI is a 0–100 reliability exposure score. Higher scores indicate greater production exposure. It is built
              from traces, incidents, audits, and deployments.
            </p>
            <p className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-secondary">
              Example: Your score is 78 because failed evals increased after your last deployment and 3 incidents remain unresolved.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">AREI breakdown</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {areiBreakdown.map((item) => (
                <div key={item} className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-secondary">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={`border-b border-zinc-200 ${marketingSectionClass}`}>
        <div className={`${marketingContainerClass} grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center`}>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-primary">Built for teams operating AI in production</h2>
            <p className="mt-3 text-sm leading-6 text-secondary">
              Reliai is used for AI copilots, RAG search systems, and agent workflows where reliability, incident response,
              and production risk posture need to be visible in real time.
            </p>
          </div>
          <div className="grid gap-2 text-sm text-secondary">
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">AI copilots</div>
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">RAG search systems</div>
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">Agent workflows</div>
          </div>
        </div>
      </section>

      <section className={marketingSectionClass}>
        <div className={`${marketingContainerClass} rounded-2xl border border-zinc-200 bg-white px-6 py-8 text-center`}>
          <h3 className="text-2xl font-semibold text-primary">Start with audit or live Pulse preview</h3>
          <p className="mt-3 text-sm leading-6 text-secondary">
            Run an AI reliability audit to get certification posture, or review Pulse to see how Reliai turns production
            reliability signals into action.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link href="/ai-reliability-audit">Run reliability audit</Link>
            </Button>
            <Button asChild variant="outline" className="border-zinc-300 text-ink hover:bg-zinc-50">
              <Link href="/demo">View Pulse dashboard</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
