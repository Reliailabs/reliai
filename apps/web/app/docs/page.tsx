import Link from "next/link";
import type { Route } from "next";

const workflowSteps = ["Detect", "Understand", "Fix", "Prove", "Share"];

const cards: { title: string; desc: string; href: string }[] = [
  {
    title: "Incident Workflow",
    desc: "Step-by-step guide to debugging AI failures",
    href: "/docs/incident-workflow",
  },
  {
    title: "Core Concepts",
    desc: "Traces, incidents, evidence, and root cause",
    href: "/docs/concepts",
  },
  {
    title: "AI Guide",
    desc: "How AI works in Reliai — and what it doesn't do",
    href: "/docs/ai",
  },
  {
    title: "Limits & Behavior",
    desc: "Sampling, rate limits, and partial data",
    href: "/docs/limits",
  },
];

export default function DocsPage() {
  return (
    <div className="space-y-[40px]">
      {/* Hero */}
      <section className="space-y-[12px]">
        <p className="text-xs uppercase tracking-[0.24em] text-textMuted">Documentation</p>
        <h1 className="text-4xl font-semibold tracking-tight text-textPrimary">
          Reliai Documentation
        </h1>
        <p className="text-sm leading-7 text-textSecondary max-w-[560px]">
          Detect, investigate, and resolve AI system issues using real-time telemetry, deterministic
          root cause analysis, and AI-assisted workflows.
        </p>
        <p className="text-xs text-textMuted italic">
          Reliai never replaces system truth with AI — it helps you understand it faster.
        </p>
      </section>

      {/* Primary CTA */}
      <section className="rounded-xl border border-border bg-surface p-[20px]">
        <p className="text-xs uppercase tracking-[0.24em] text-textMuted">Get started</p>
        <div className="mt-[8px] text-sm text-textSecondary">
          Understand how Reliai works in minutes, then connect your system.
        </div>
        <div className="mt-[12px] flex flex-wrap gap-[10px]">
          <Link
            href={"/docs/getting-started" as Route}
            className="inline-flex items-center rounded-md bg-white px-[14px] py-[8px] text-xs font-semibold text-textPrimary shadow-sm transition hover:text-black"
          >
            Connect your system →
          </Link>
          <Link
            href={"/onboarding?path=simulation" as Route}
            className="inline-flex items-center rounded-md border border-border px-[14px] py-[8px] text-xs font-semibold text-textSecondary transition hover:text-textPrimary"
          >
            Run the 2-minute simulation →
          </Link>
        </div>
      </section>

      {/* Start here */}
      <section className="rounded-xl border border-border bg-surface p-[20px]">
        <p className="text-xs uppercase tracking-[0.2em] text-textMuted mb-[16px]">Start here</p>
        <ul className="space-y-[10px]">
          <li>
            <Link href={"/docs/concepts" as Route} className="text-sm text-textSecondary hover:text-textPrimary transition-colors underline-offset-4 hover:underline">
              What is Reliai?
            </Link>
            <span className="ml-[8px] text-xs text-textMuted">— traces, incidents, and how the system works</span>
          </li>
          <li>
            <Link href={"/docs/incident-workflow" as Route} className="text-sm text-textSecondary hover:text-textPrimary transition-colors underline-offset-4 hover:underline">
              How to investigate an incident
            </Link>
            <span className="ml-[8px] text-xs text-textMuted">— Detect → Understand → Fix → Prove → Share</span>
          </li>
          <li>
            <Link href={"/docs/ai" as Route} className="text-sm text-textSecondary hover:text-textPrimary transition-colors underline-offset-4 hover:underline">
              How AI works in Reliai
            </Link>
            <span className="ml-[8px] text-xs text-textMuted">— what AI does and does not do</span>
          </li>
          <li>
            <Link href={"/docs/limits" as Route} className="text-sm text-textSecondary hover:text-textPrimary transition-colors underline-offset-4 hover:underline">
              How limits and partial data work
            </Link>
            <span className="ml-[8px] text-xs text-textMuted">— sampling, truncation, and what it means for evidence</span>
          </li>
        </ul>
      </section>

      {/* Workflow */}
      <section className="rounded-xl border border-border bg-surface p-[20px]">
        <p className="text-xs uppercase tracking-[0.2em] text-textMuted mb-[16px]">
          Core workflow
        </p>
        <div className="flex items-center gap-[8px]">
          {workflowSteps.map((step, i) => (
            <div key={step} className="flex items-center gap-[8px]">
              <div className="rounded-lg border border-border bg-bg px-[12px] py-[8px] text-center">
                <div className="text-sm font-medium text-textPrimary">{step}</div>
              </div>
              {i < workflowSteps.length - 1 && (
                <span className="text-textMuted text-xs">→</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Navigation cards */}
      <section className="grid grid-cols-2 gap-[12px]">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href as never}
            className="block rounded-xl border border-border bg-surface p-[20px] hover:border-textMuted transition-colors group"
          >
            <div className="text-sm font-semibold text-textPrimary group-hover:text-white">
              {card.title}
            </div>
            <div className="text-xs text-textSecondary mt-[4px] leading-5">{card.desc}</div>
          </Link>
        ))}
      </section>
    </div>
  );
}
