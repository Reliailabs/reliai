"use client"

import { motion } from "framer-motion"
import { ChevronRight } from "lucide-react"
import { MarketingSection } from "./marketing-section"

const workflowSteps = [
  { title: "Detect", description: "Identify regressions through metrics and trace patterns." },
  { title: "Understand", description: "Analyze root cause using trace comparison and evidence." },
  { title: "Fix", description: "Apply changes based on system recommendations and inspection." },
  { title: "Prove", description: "Verify improvement using resolution impact." },
  { title: "Share", description: "Export context via ticket drafts and fix summaries." },
]

const systemAreas = [
  {
    title: "Instrumentation",
    description:
      "Capture traces across your AI system — requests and responses, retrieval and tool calls, guardrail and policy events.",
  },
  {
    title: "Operator workflows",
    description:
      "Investigate incidents, compare traces, review root cause analysis, and validate fixes using the command center.",
  },
  {
    title: "Governance and runtime protection",
    description:
      "Apply guardrail policies, monitor compliance checks, and get mitigation guidance for production paths.",
  },
]

const aiUses = [
  "Summarize incidents",
  "Explain root cause evidence",
  "Draft tickets and summaries",
]

const aiNonUses = [
  "Generate traces",
  "Determine root cause",
  "Trigger actions",
  "Modify system data",
]

const limits = [
  { title: "Sampling active", description: "Some traces are not stored." },
  { title: "Rate limited", description: "Some data may be delayed or dropped." },
  { title: "Processing delayed", description: "Analysis is queued." },
  { title: "Payload truncated", description: "Some fields are incomplete." },
]

const startHere = [
  {
    role: "Operators",
    title: "Incident workflow",
    description:
      "How to detect, investigate, and resolve an AI incident using traces, root cause analysis, and the command center.",
  },
  {
    role: "All",
    title: "Core concepts",
    description:
      "Traces, incidents, regressions, guardrails, and deployments — what they mean and how they connect.",
  },
  {
    role: "Engineers",
    title: "AI in Reliai",
    description:
      "Where AI assists operators, where it does not, and the deterministic guarantees the platform makes.",
  },
]

export function DocsPage() {
  return (
    <>
      {/* Hero */}
      <MarketingSection py="hero">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-2 mb-6"
        >
          <div className="w-2 h-2 rounded-full bg-zinc-400" />
          <span className="text-zinc-400 text-sm">Docs</span>
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
          Understand, debug, and operate AI systems in production.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-zinc-400 max-w-lg mb-4"
        >
          Reliai gives operators and engineers a shared view of AI system behavior — traces,
          incidents, regressions, and guardrails — without replacing the engineering judgment
          behind decisions.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="text-zinc-500 text-sm italic mb-10"
        >
          Reliai never replaces system truth with AI — it helps you understand it faster.
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
            View demo
          </a>
          <a
            href="/sign-in"
            className="px-5 py-2.5 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-100 transition-colors text-sm"
          >
            Get started
          </a>
        </motion.div>
      </MarketingSection>

      {/* Start here — entry vectors before the deep content */}
      <MarketingSection gradient>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-2 mb-6"
        >
          <div className="w-2 h-2 rounded-full bg-zinc-500" />
          <span className="text-zinc-400 text-sm">Start here</span>
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
          Pick your entry point.
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {startHere.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
              className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-2xl p-6 h-full flex flex-col gap-3"
            >
              <span className="text-zinc-600 text-xs uppercase tracking-wider">{item.role}</span>
              <h3 className="text-white font-medium text-lg">{item.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed flex-1">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </MarketingSection>

      {/* How it works */}
      <MarketingSection>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-2 mb-6"
        >
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-zinc-400 text-sm">Operational loop</span>
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
          How Reliai works
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-zinc-500 mb-16"
        >
          Every incident flows through the same five-step loop. The platform surfaces evidence at
          each stage so decisions stay grounded in trace data, not assumptions.
        </motion.p>

        <div className="flex flex-col max-w-lg">
          {workflowSteps.map((step, index) => (
            <motion.div
              key={step.title}
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
                {index < workflowSteps.length - 1 && (
                  <div className="w-px flex-1 bg-zinc-800 my-2" />
                )}
              </div>
              <div className="pb-10">
                <h3 className="text-white font-medium mb-1">{step.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </MarketingSection>

      {/* System areas */}
      <MarketingSection>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-2 mb-6"
        >
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-zinc-400 text-sm">System areas</span>
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
          Three system layers
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {systemAreas.map((area, index) => (
            <motion.div
              key={area.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
              className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors rounded-2xl p-6 h-full flex flex-col gap-3"
            >
              <h3 className="text-white font-medium text-lg">{area.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed flex-1">{area.description}</p>
            </motion.div>
          ))}
        </div>
      </MarketingSection>

      {/* AI in Reliai */}
      <MarketingSection>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-2 mb-6"
        >
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-zinc-400 text-sm">AI use policy</span>
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
          AI assists. It does not decide.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-zinc-500 mb-16"
        >
          Root cause analysis is deterministic. AI accelerates operator understanding — it never
          modifies system state or determines the source of truth.
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="border-t border-r border-b border-zinc-800/60 pt-12 pr-12 pb-16"
          >
            <h3 className="text-zinc-200 font-medium text-xl mb-6">AI is used for</h3>
            <div className="flex flex-col gap-3">
              {aiUses.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-zinc-400 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="border-t border-b border-zinc-800/60 pt-12 pl-12 pb-16"
          >
            <h3 className="text-zinc-200 font-medium text-xl mb-6">AI is NOT used for</h3>
            <div className="flex flex-col gap-3">
              {aiNonUses.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 flex-shrink-0" />
                  <span className="text-zinc-500 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </MarketingSection>

      {/* Limits */}
      <MarketingSection>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-2xl sm:text-3xl text-zinc-300 max-w-xl mb-4"
          style={{ letterSpacing: "-0.02em", fontWeight: 500, lineHeight: 1.2 }}
        >
          Limits & partial data
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-zinc-500 mb-12"
        >
          Reliai surfaces system limits clearly rather than hiding them. You may see:
        </motion.p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {limits.map((limit, index) => (
            <motion.div
              key={limit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.08 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5"
            >
              <p className="text-zinc-300 font-medium text-sm mb-2">{limit.title}</p>
              <p className="text-zinc-500 text-xs leading-relaxed">{limit.description}</p>
            </motion.div>
          ))}
        </div>
      </MarketingSection>

      {/* CTA */}
      <MarketingSection maxWidth="6xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <h2 className="text-3xl md:text-4xl lg:text-[42px] font-medium text-white tracking-tight">
            Start understanding your AI system.
          </h2>
          <div className="flex items-center gap-3 flex-shrink-0">
            <a
              href="/demo"
              className="px-5 py-2.5 border border-zinc-700 text-white font-medium rounded-lg hover:bg-zinc-800 transition-colors text-sm"
            >
              View demo
            </a>
            <a
              href="/sign-in"
              className="px-5 py-2.5 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-100 transition-colors text-sm"
            >
              Get started
            </a>
          </div>
        </div>
      </MarketingSection>
    </>
  )
}
