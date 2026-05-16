"use client"

import { motion } from "framer-motion"
import { ChevronRight } from "lucide-react"
import { Navbar } from "./navbar"
import { Footer } from "./footer"

const auditStages = [
  {
    title: "Scope Analysis",
    description: "We map your AI system, use cases, and highest-risk failure surfaces.",
  },
  {
    title: "Reliability Testing",
    description:
      "We stress-test prompts, workflows, and outputs for failures in realistic conditions.",
  },
  {
    title: "Findings Validation",
    description: "We verify each issue to remove noise and confirm reproducible risk.",
  },
  {
    title: "Risk Review",
    description:
      "We assess system-wide reliability patterns and prioritize the highest-impact concerns.",
  },
  {
    title: "Certification Decision",
    description:
      "We issue a clear production readiness outcome with remediation guidance.",
  },
]

const riskTypes = [
  {
    title: "Silent failures",
    description:
      "Errors that never throw, but quietly degrade outcomes and customer experience.",
    impact: "Erodes trust without triggering obvious alerts.",
  },
  {
    title: "Hallucinations",
    description: "False answers or invented facts that make it into production responses.",
    impact: "Creates costly rework and escalations downstream.",
  },
  {
    title: "Broken automations",
    description:
      "Tool calls fail, retries loop, and workflows stall without clear visibility.",
    impact: "Missed SLAs and manual recovery drain engineering time.",
  },
  {
    title: "Undetected regressions",
    description: "Model or prompt changes shift behavior without obvious warnings.",
    impact: "Quality drops before anyone can tie it to a change.",
  },
  {
    title: "Prompt + model drift",
    description:
      "Small changes compound until the system behaves differently than expected.",
    impact: "Gradual degradation that chips away at product reliability.",
  },
]

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
]

export function AuditPage() {
  return (
    <div style={{ backgroundColor: "#09090B", minHeight: "100vh" }}>
      <Navbar />

      {/* Hero */}
      <div className="w-full flex justify-center px-6 pt-40 pb-24">
        <div className="w-full max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            {/* Left */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="flex items-center gap-2 mb-6"
              >
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-zinc-400 text-sm">AI Reliability Audit</span>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-4xl md:text-5xl font-medium text-white mb-6"
                style={{
                  letterSpacing: "-0.0325em",
                  fontVariationSettings: '"opsz" 28',
                  lineHeight: 1.1,
                }}
              >
                Find and Fix Hidden Failures in Your AI System in 7 Days
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-zinc-400 mb-4 leading-relaxed"
              >
                We instrument your production LLM workflows, analyze real traces, and identify 3–5
                concrete failure modes like hallucinations, regressions, and silent breakdowns. Then
                we implement guardrails and alerts to reduce the risk of user-facing AI incidents.
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="text-zinc-500 text-sm mb-8"
              >
                For teams already running LLMs in production.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col gap-4"
              >
                <a
                  href="/demo"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-100 transition-colors text-sm w-fit"
                >
                  View demo
                </a>
                <div className="border border-zinc-800 rounded-lg px-4 py-3 text-zinc-400 text-sm max-w-sm">
                  If we don&apos;t find at least 3 real issues or meaningful risks, you don&apos;t
                  pay.
                </div>
              </motion.div>
            </div>

            {/* Right — engagement snapshot */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 flex flex-col gap-6 self-start mt-8 md:mt-16"
            >
              {[
                {
                  metric: "7 days",
                  description: "Instrument, analyze, and harden your system.",
                },
                {
                  metric: "3–5 failure modes",
                  description: "Documented issues with evidence, impact, and remediation paths.",
                },
                {
                  metric: "Guardrails live",
                  description: "Validation, retries, and alerts in place before handoff.",
                },
              ].map((item) => (
                <div key={item.metric} className="flex flex-col gap-1">
                  <span className="text-white font-medium">{item.metric}</span>
                  <span className="text-zinc-500 text-sm leading-relaxed">{item.description}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* How it works */}
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
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-zinc-400 text-sm">How it works</span>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] text-white max-w-3xl mb-4"
              style={{
                letterSpacing: "-0.0325em",
                fontVariationSettings: '"opsz" 28',
                fontWeight: 538,
                lineHeight: 1.1,
              }}
            >
              Identify failures, validate evidence, and harden before production.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-zinc-500 mb-16 max-w-md"
            >
              A five-stage audit workflow built for decision-ready reliability and certification
              outcomes.
            </motion.p>

            <div className="flex flex-col max-w-lg">
              {auditStages.map((stage, index) => (
                <motion.div
                  key={stage.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.08 }}
                  className="flex gap-6"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full border border-zinc-700 bg-zinc-900 flex items-center justify-center text-zinc-400 text-xs font-medium flex-shrink-0">
                      {index + 1}
                    </div>
                    {index < auditStages.length - 1 && (
                      <div className="w-px flex-1 bg-zinc-800 my-2" />
                    )}
                  </div>
                  <div className="pb-10">
                    <h3 className="text-white font-medium mb-1">{stage.title}</h3>
                    <p className="text-zinc-500 text-sm leading-relaxed">{stage.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Risk types */}
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
              <span className="text-zinc-400 text-sm">The risk</span>
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
              Hidden failures stay invisible until customers feel them.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-zinc-400 max-w-md mb-16"
            >
              Production LLM systems often fail in ways that never surface as obvious errors. This
              audit isolates the exact failure surfaces before they become user-facing incidents.
            </motion.p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {riskTypes.map((risk, index) => (
                <motion.div
                  key={risk.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.08 }}
                  className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-2xl p-6 flex flex-col gap-3"
                >
                  <h3 className="text-white font-medium">{risk.title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{risk.description}</p>
                  <p className="text-zinc-600 text-xs border-t border-zinc-800 pt-3 mt-auto">
                    Impact: {risk.impact}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Deliverables */}
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
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-zinc-400 text-sm">What you get</span>
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
              A reliability upgrade, delivered in one week.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-zinc-400 max-w-md mb-16"
            >
              Every deliverable is concrete, documented, and tied to real traces from your
              production system.
            </motion.p>

            <div className="flex flex-col">
              {deliverables.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.3 + index * 0.08 }}
                  className="border-b border-zinc-800 py-6 flex flex-col md:flex-row md:items-start gap-2 md:gap-12"
                >
                  <h3 className="text-white font-medium text-base md:w-80 flex-shrink-0">
                    {item.title}
                  </h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{item.benefit}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Guarantee */}
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
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-zinc-400 text-sm">Guarantee</span>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8"
            >
              <h2
                className="text-3xl font-medium text-white mb-4"
                style={{ letterSpacing: "-0.0325em", fontWeight: 538 }}
              >
                If we do not find meaningful issues, you do not pay.
              </h2>
              <p className="text-zinc-400 text-base leading-relaxed">
                If we do not find at least 3 real issues or meaningful risks, you do not pay.
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="relative z-20 py-24" style={{ backgroundColor: "#09090B" }}>
        <div className="w-full flex justify-center px-6">
          <div className="w-full max-w-5xl">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-3xl sm:text-4xl text-white max-w-xl mb-4"
              style={{ letterSpacing: "-0.0325em", fontWeight: 538, lineHeight: 1.1 }}
            >
              Typical engagement: $8k–$12k
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-zinc-400 max-w-md mb-12"
            >
              Fixed-scope audit focused on immediate reliability outcomes, with documented findings,
              guardrails, and alerts.
            </motion.p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-2xl p-8 flex flex-col gap-3"
              >
                <span className="text-zinc-400 text-sm">Standard engagement</span>
                <span className="text-white font-medium text-2xl">$8k–$12k</span>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Includes full failure analysis, guardrail implementation, and incident replay.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="bg-zinc-900/50 border border-zinc-600 hover:border-zinc-500 transition-colors rounded-2xl p-8 flex flex-col gap-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 text-sm">Design partners</span>
                  <span className="bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded">
                    Limited availability
                  </span>
                </div>
                <span className="text-white font-medium text-2xl">$5k</span>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Same audit, same depth. Limited design partner slots available for teams willing
                  to move quickly and provide tight feedback during rollout.
                </p>
              </motion.div>
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
                Book a 20-minute call to scope the audit.
              </h2>
              <p className="text-zinc-400 text-base leading-relaxed">
                We&apos;ll confirm fit, scope the audit, and map the fastest path to a 7-day
                engagement.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <a
                href="/demo"
                className="px-5 py-2.5 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-100 transition-colors text-sm"
              >
                View demo
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
