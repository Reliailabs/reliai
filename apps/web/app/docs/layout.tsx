import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    template: "%s — Reliai Docs",
    default: "Reliai Docs",
  },
  description:
    "Detect, investigate, and resolve AI system issues using real-time telemetry, deterministic root cause analysis, and AI-assisted workflows.",
};

const navItems: { label: string; href: string; group?: string }[] = [
  { label: "Overview", href: "/docs" },
  { label: "Incident Workflow", href: "/docs/incident-workflow" },
  { label: "Core Concepts", href: "/docs/concepts" },
  { label: "AI Guide", href: "/docs/ai" },
  { label: "Limits & Behavior", href: "/docs/limits" },
  { label: "Examples", href: "/docs/examples", group: "examples" },
  { label: "RAG System", href: "/docs/examples/rag", group: "examples" },
  { label: "AI Copilot", href: "/docs/examples/copilot", group: "examples" },
  { label: "Agents", href: "/docs/examples/agents", group: "examples" },
  { label: "Structured Output", href: "/docs/examples/structured-output", group: "examples" },
  { label: "Guardrails", href: "/docs/examples/guardrails", group: "examples" },
];

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg text-textPrimary">
      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 border-r border-border px-[20px] py-[32px]">
        <Link href="/docs" className="block mb-[32px]">
          <span className="text-sm font-semibold text-textPrimary">Reliai Docs</span>
        </Link>

        <nav className="space-y-[2px]">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href as never}
              className={`block rounded px-[8px] py-[6px] text-sm text-textSecondary hover:bg-surface hover:text-textPrimary transition-colors${item.group === "examples" && item.href !== "/docs/examples" ? " pl-[20px] text-xs" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-[40px] pt-[20px] border-t border-border">
          <Link
            href="/"
            className="block text-xs text-textMuted hover:text-textSecondary transition-colors"
          >
            ← Back to Reliai
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0 px-[48px] py-[48px] max-w-[780px]">{children}</main>
    </div>
  );
}
