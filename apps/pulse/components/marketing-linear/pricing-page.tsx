"use client"

import { motion } from "framer-motion"
import { ChevronRight } from "lucide-react"

const tiers = [
  {
    name: "Evaluate",
    price: "$0",
    description: "Validate Reliai on a single service with a live control panel.",
    features: [
      "Single project workspace",
      "Trace ingestion + graph view",
      "Incident timeline",
      "Limited daily traces",
    ],
    unlock: "Unlocks a live demo loop for your first workload.",
  },
  {
    name: "Team",
    price: "$49 / seat",
    description: "Shared reliability operations for the team shipping AI changes.",
    features: [
      "Multiple members and projects",
      "Guardrail triggers + retries",
      "Deploy compare and regression views",
      "Alert routing to Slack + email",
    ],
    unlock: "Unlocks collaboration, shared incidents, and team workflows.",
  },
  {
    name: "Production",
    price: "$199 / month",
    description: "Operate customer-facing AI systems with audit visibility and SLOs.",
    features: [
      "Audit log access",
      "Viewer roles + reporting links",
      "Incident severity routing",
      "Higher trace limits",
      "Priority onboarding",
    ],
    unlock: "Unlocks production governance without slowing releases.",
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "Dedicated support, private deployments, and enterprise reliability reviews.",
    features: [
      "Dedicated reliability partner",
      "Private cloud / on-prem",
      "Custom data retention",
      "Executive reporting",
    ],
    unlock: "Unlocks enterprise rollout and security review.",
  },
]

const upgradeReasons = [
  {
    title: "On-call signal that stays sharp.",
    description:
      "Move beyond demo-grade telemetry. Teams upgrade to keep trace volume, guardrails, and regression evidence flowing.",
  },
  {
    title: "Shared accountability.",
    description:
      "Incidents are a team sport. Upgrade when multiple engineers need access to the same investigations.",
  },
  {
    title: "Operational proof.",
    description:
      "Leaders want to see reliability improvements. Production adds auditability and reportable outcomes.",
  },
]

const triggers = [
  {
    title: "When you hit your trace limit",
    description:
      "You need continuous visibility during a rollout, not throttled snapshots. Upgrade to keep the signal live.",
  },
  {
    title: "When your team joins",
    description:
      "Incidents move faster when engineers share the same timeline, notes, and evidence.",
  },
  {
    title: "When something breaks",
    description:
      "Reliability work needs a record. Audit-ready incident trails are production-grade by default.",
  },
  {
    title: "When you need to show results",
    description:
      "Execs and product leads want proof: regression deltas, resolved incidents, and guardrail impact.",
  },
  {
    title: "When reliability matters",
    description:
      "The platform becomes a control room, not just a dashboard. That is the Production tier.",
  },
]

export function PricingPage() {
  return (
    <div style={{ backgroundColor: "#09090B", minHeight: "100vh" }}>
      {/* Hero */}
      <div className="w-full flex justify-center px-6 pt-40 pb-24">
        <div className="w-full max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-2 mb-6"
          >
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-zinc-400 text-sm">Pricing</span>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-[56px] font-medium text-white max-w-3xl mb-8"
            style={{
              letterSpacing: "-0.0325em",
              fontVariationSettings: '"opsz" 28',
              lineHeight: 1.1,
            }}
          >
            Upgrade when reliability becomes a job, not a side project.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-zinc-400 max-w-lg mb-10"
          >
            Reliai pricing follows how teams actually adopt reliability. Start small, then upgrade
            the moment the signal needs to stay live.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center gap-4"
          >
            <a
              href="/demo"
              className="px-5 py-2.5 border border-zinc-700 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors text-sm"
            >
              Start with the demo
            </a>
            <a
              href="/ai-reliability-audit"
              className="px-5 py-2.5 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-100 transition-colors text-sm"
            >
              Run reliability audit
            </a>
          </motion.div>
        </div>
      </div>

      {/* Plans */}
      <div className="relative z-20 py-24" style={{ backgroundColor: "#09090B" }}>
        <div
          className="absolute top-0 left-0 right-0 pointer-events-none"
          style={{
            height: "20%",
            background: "linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, transparent 100%)",
          }}
        />
        <div className="w-full flex justify-center px-6">
          <div className="w-full max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="flex items-center gap-2 mb-6"
            >
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-zinc-400 text-sm">Plans</span>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] text-white max-w-3xl mb-8"
              style={{
                letterSpacing: "-0.0325em",
                fontVariationSettings: '"opsz" 28',
                fontWeight: 538,
                lineHeight: 1.1,
              }}
            >
              Pricing that tracks your reliability maturity.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-zinc-400 max-w-md mb-16"
            >
              Every tier ships the same core product. The difference is how much you can rely on it
              in production.
            </motion.p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tiers.map((tier, index) => (
                <motion.div
                  key={tier.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                  className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-2xl p-8 flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-zinc-400 text-sm">{tier.name}</span>
                    <span className="text-white font-medium">{tier.price}</span>
                  </div>
                  <p className="text-zinc-500 text-sm leading-relaxed">{tier.description}</p>
                  <ul className="flex flex-col gap-2">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-zinc-300 text-sm">
                        <div className="w-1 h-1 rounded-full bg-zinc-500 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <p className="text-zinc-600 text-xs border-t border-zinc-800 pt-4 mt-auto">
                    {tier.unlock}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade reasons */}
      <div className="relative z-20 py-24" style={{ backgroundColor: "#09090B" }}>
        <div className="w-full flex justify-center px-6">
          <div className="w-full max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="flex items-center gap-2 mb-6"
            >
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-zinc-400 text-sm">Upgrade reasons</span>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] text-white max-w-3xl mb-16"
              style={{
                letterSpacing: "-0.0325em",
                fontVariationSettings: '"opsz" 28',
                fontWeight: 538,
                lineHeight: 1.1,
              }}
            >
              The moment Reliai becomes your control room.
            </motion.h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
              {upgradeReasons.map((reason, index) => (
                <motion.div
                  key={reason.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                  className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-2xl p-6 flex flex-col gap-3"
                >
                  <h3 className="text-white font-medium text-base">{reason.title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{reason.description}</p>
                </motion.div>
              ))}
            </div>

            {/* Operator note */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8"
            >
              <h3 className="text-zinc-200 font-medium text-xl mb-3">
                Upgrade triggers are lived moments.
              </h3>
              <p className="text-zinc-500 text-base leading-relaxed mb-6">
                If you are already discussing incidents or guardrails in Slack, you are past the
                Evaluate tier. Plan changes should remove friction, not add procurement.
              </p>
              <div className="flex flex-col gap-2">
                {[
                  "Team tier removes member limits.",
                  "Production tier unlocks audit trails.",
                  "Enterprise tier meets compliance and scale.",
                ].map((point) => (
                  <div key={point} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 flex-shrink-0" />
                    <span className="text-zinc-400 text-sm">{point}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Trigger guide */}
      <div className="relative z-20 py-24" style={{ backgroundColor: "#09090B" }}>
        <div className="w-full flex justify-center px-6">
          <div className="w-full max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="flex items-center gap-2 mb-6"
            >
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-zinc-400 text-sm">Upgrade triggers</span>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] text-white max-w-3xl mb-8"
              style={{
                letterSpacing: "-0.0325em",
                fontVariationSettings: '"opsz" 28',
                fontWeight: 538,
                lineHeight: 1.1,
              }}
            >
              Upgrade when the signal would otherwise break.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-zinc-400 max-w-md mb-16"
            >
              These are the moments teams see value in Reliai. Each one maps to an immediate
              capability upgrade.
            </motion.p>

            <div className="flex flex-col">
              {triggers.map((trigger, index) => (
                <motion.div
                  key={trigger.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.08 }}
                  className="border-b border-zinc-800 py-6 flex flex-col md:flex-row md:items-start gap-3 md:gap-8"
                >
                  <span className="text-zinc-500 text-sm w-6 flex-shrink-0 pt-0.5">{index + 1}</span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-white font-medium text-base">{trigger.title}</h3>
                    <p className="text-zinc-500 text-sm leading-relaxed">{trigger.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <section className="py-24 px-6" style={{ backgroundColor: "#09090B" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-lg">
              <h2 className="text-3xl md:text-4xl lg:text-[42px] font-medium text-white tracking-tight mb-4">
                Run the demo, then upgrade at the first real incident.
              </h2>
              <p className="text-zinc-400 text-base leading-relaxed">
                Pricing should not slow an incident response. Start free, then move the moment the
                data matters.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <a
                href="/demo"
                className="px-5 py-2.5 border border-zinc-700 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors text-sm"
              >
                Start with Evaluate
              </a>
              <a
                href="/demo"
                className="px-5 py-2.5 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-100 transition-colors text-sm"
              >
                Tour the dashboard
              </a>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
