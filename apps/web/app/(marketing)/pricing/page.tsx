import Link from "next/link";

import { marketingContainerClass, marketingSectionLargeClass } from "@/components/marketing/spatial-system";
import { Button } from "@/components/ui/button";

const tiers = [
  {
    name: "Evaluate",
    price: "$0",
    description: "Validate Reliai on a single service with a live control panel.",
    capabilities: [
      "Single project workspace",
      "Trace ingestion + graph view",
      "Incident timeline",
      "Limited daily traces",
    ],
    unlocks: "Unlocks a live demo loop for your first workload.",
    accent: "border-zinc-200 bg-white",
  },
  {
    name: "Team",
    price: "$49 / seat",
    description: "Shared reliability operations for the team shipping AI changes.",
    capabilities: [
      "Multiple members and projects",
      "Guardrail triggers + retries",
      "Deploy compare and regression views",
      "Alert routing to Slack + email",
    ],
    unlocks: "Unlocks collaboration, shared incidents, and team workflows.",
    accent: "border-ink bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]",
  },
  {
    name: "Production",
    price: "$199 / month",
    description: "Operate customer-facing AI systems with audit visibility and SLOs.",
    capabilities: [
      "Audit log access",
      "Viewer roles + reporting links",
      "Incident severity routing",
      "Higher trace limits",
      "Priority onboarding",
    ],
    unlocks: "Unlocks production governance without slowing releases.",
    accent: "border-zinc-200 bg-zinc-50",
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "Dedicated support, private deployments, and enterprise reliability reviews.",
    capabilities: [
      "Dedicated reliability partner",
      "Private cloud / on-prem",
      "Custom data retention",
      "Executive reporting",
    ],
    unlocks: "Unlocks enterprise rollout and security review.",
    accent: "border-zinc-200 bg-white",
  },
];

const triggers = [
  {
    title: "When you hit your trace limit",
    body: "You need continuous visibility during a rollout, not throttled snapshots. Upgrade to keep the signal live.",
  },
  {
    title: "When your team joins",
    body: "Incidents move faster when engineers share the same timeline, notes, and evidence.",
  },
  {
    title: "When something breaks",
    body: "Reliability work needs a record. Audit-ready incident trails are production-grade by default.",
  },
  {
    title: "When you need to show results",
    body: "Execs and product leads want proof: regression deltas, resolved incidents, and guardrail impact.",
  },
  {
    title: "When reliability matters",
    body: "The platform becomes a control room, not just a dashboard. That is the Production tier.",
  },
];

const upgradeReasons = [
  {
    title: "On-call signal that stays sharp.",
    body: "Move beyond demo-grade telemetry. Teams upgrade to keep trace volume, guardrails, and regression evidence flowing.",
  },
  {
    title: "Shared accountability.",
    body: "Incidents are a team sport. Upgrade when multiple engineers need access to the same investigations.",
  },
  {
    title: "Operational proof.",
    body: "Leaders want to see reliability improvements. Production adds auditability and reportable outcomes.",
  },
];

export default function PricingPage() {
  return (
    <main className={`${marketingContainerClass} ${marketingSectionLargeClass} pb-28`}>
      <section className="relative overflow-hidden rounded-[28px] border border-zinc-200 bg-white px-8 py-16 shadow-[0_30px_80px_rgba(15,23,42,0.08)] md:px-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.10),_transparent_60%)]" />
        <div className="pointer-events-none absolute -right-20 top-6 h-48 w-48 rounded-full bg-[radial-gradient(circle,_rgba(185,28,28,0.2),_transparent_70%)] blur-2xl" />
        <div className="relative max-w-2xl">
          <p className="text-xs uppercase tracking-[0.4em] text-secondary">Pricing</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-primary md:text-6xl">
            Upgrade when reliability becomes a job, not a side project.
          </h1>
          <p className="mt-6 text-base leading-8 text-secondary">
            Reliai pricing follows how teams actually adopt reliability. Start small, then upgrade the moment the signal
            needs to stay live.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/signup">Start with the demo</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/demo">See the control panel</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="text-xs uppercase tracking-[0.36em] text-secondary">Plans</p>
            <h2 className="mt-4 text-3xl font-semibold text-primary">Pricing that tracks your reliability maturity.</h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-secondary">
            Every tier ships the same core product. The difference is how much you can rely on it in production.
          </p>
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-4">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`flex h-full flex-col justify-between rounded-2xl border p-6 ${tier.accent}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xl font-semibold text-primary">{tier.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-secondary">{tier.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-primary">{tier.price}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-secondary">Plan</p>
                  </div>
                </div>
                <ul className="mt-6 space-y-3 text-sm text-secondary">
                  {tier.capabilities.map((capability) => (
                    <li key={capability} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                      <span>{capability}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-6 text-xs uppercase tracking-[0.28em] text-secondary">{tier.unlocks}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <p className="text-xs uppercase tracking-[0.36em] text-secondary">Why teams upgrade</p>
          <h2 className="mt-4 text-3xl font-semibold text-primary">The moment Reliai becomes your control room.</h2>
          <div className="mt-6 space-y-6 text-sm text-secondary">
            {upgradeReasons.map((reason) => (
              <div key={reason.title}>
                <p className="text-base font-semibold text-primary">{reason.title}</p>
                <p className="mt-2 leading-7">{reason.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8">
          <p className="text-xs uppercase tracking-[0.36em] text-secondary">Operator note</p>
          <h3 className="mt-4 text-2xl font-semibold text-primary">Upgrade triggers are lived moments.</h3>
          <p className="mt-4 text-sm leading-7 text-secondary">
            If you are already discussing incidents or guardrails in Slack, you are past the Evaluate tier. Plan changes
            should remove friction, not add procurement.
          </p>
          <div className="mt-8 grid gap-4 text-sm text-primary">
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">Team tier removes member limits.</div>
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">Production tier unlocks audit trails.</div>
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">Enterprise tier meets compliance and scale.</div>
          </div>
        </div>
      </section>

      <section className="mt-20">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.36em] text-secondary">Trigger guide</p>
          <h2 className="mt-4 text-3xl font-semibold text-primary">Upgrade when the signal would otherwise break.</h2>
          <p className="mt-4 text-sm leading-7 text-secondary">
            These are the moments teams see value in Reliai. Each one maps to an immediate capability upgrade.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {triggers.map((trigger) => (
            <div key={trigger.title} className="rounded-2xl border border-zinc-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-primary">{trigger.title}</h3>
              <p className="mt-3 text-sm leading-7 text-secondary">{trigger.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20 flex flex-col items-start justify-between gap-6 rounded-[28px] border border-ink/10 bg-ink px-8 py-12 text-white md:flex-row md:items-center">
        <div className="max-w-xl">
          <p className="text-xs uppercase tracking-[0.36em] text-white/70">Final CTA</p>
          <h2 className="mt-4 text-3xl font-semibold">Run the demo, then upgrade at the first real incident.</h2>
          <p className="mt-4 text-sm leading-7 text-white/70">
            Pricing should not slow an incident response. Start free, then move the moment the data matters.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="subtle" className="bg-white text-primary hover:bg-white/90">
            <Link href="/signup">Start with Evaluate</Link>
          </Button>
          <Button asChild variant="outline" className="border-white/60 bg-white text-primary hover:bg-white/90">
            <Link href="/demo">Tour the dashboard</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
