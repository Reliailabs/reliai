import Link from "next/link";

export const metadata = { title: "Example Systems" };

const examples: { title: string; desc: string; href: string }[] = [
  {
    title: "RAG System",
    desc: "Debug retrieval failures and hallucinations in production RAG pipelines",
    href: "/docs/examples/rag",
  },
  {
    title: "AI Support Copilot",
    desc: "Handle hallucination spikes in production assistants with tool calling",
    href: "/docs/examples/copilot",
  },
  {
    title: "Agent Workflows",
    desc: "Investigate multi-step reasoning failures and execution loops",
    href: "/docs/examples/agents",
  },
  {
    title: "Structured Output",
    desc: "Fix JSON and schema failures in LLM outputs",
    href: "/docs/examples/structured-output",
  },
  {
    title: "Guardrails",
    desc: "Diagnose safety, policy, and over-blocking failures",
    href: "/docs/examples/guardrails",
  },
];

export default function ExamplesPage() {
  return (
    <div className="space-y-[32px]">
      <div className="space-y-[8px]">
        <p className="text-xs uppercase tracking-[0.24em] text-textMuted">Examples</p>
        <h1 className="text-3xl font-semibold tracking-tight text-textPrimary">Example Systems</h1>
        <p className="text-sm leading-7 text-textSecondary max-w-[520px]">
          See how Reliai detects, investigates, and resolves real AI system failures — from
          retrieval failures to guardrail drift.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-[12px]">
        {examples.map((ex) => (
          <Link
            key={ex.title}
            href={ex.href as never}
            className="block rounded-xl border border-border bg-surface p-[20px] hover:border-textMuted transition-colors group"
          >
            <div className="text-sm font-semibold text-textPrimary group-hover:text-white">
              {ex.title}
            </div>
            <div className="text-xs text-textSecondary mt-[4px] leading-5">{ex.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
