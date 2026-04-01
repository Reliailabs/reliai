import Link from "next/link";

const workflowSteps = ["Detect", "Understand", "Fix", "Prove", "Share"];

const cards = [
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
            href={card.href}
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
