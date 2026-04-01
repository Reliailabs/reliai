import type { Metadata, ReactNode } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    template: "%s — Reliai Docs",
    default: "Reliai Docs",
  },
  description:
    "Detect, investigate, and resolve AI system issues using real-time telemetry, deterministic root cause analysis, and AI-assisted workflows.",
};

const navItems = [
  { label: "Overview", href: "/docs" },
  { label: "Incident Workflow", href: "/docs/incident-workflow" },
  { label: "Core Concepts", href: "/docs/concepts" },
  { label: "AI Guide", href: "/docs/ai" },
  { label: "Limits & Behavior", href: "/docs/limits" },
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
              href={item.href}
              className="block rounded px-[8px] py-[6px] text-sm text-textSecondary hover:bg-surface hover:text-textPrimary transition-colors"
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
