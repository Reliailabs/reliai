import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Reliai | Reliability Control Plane for Production AI",
  description:
    "Reliai detects AI regressions, explains root causes, and applies guardrails before failures impact users.",
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f8fa] text-ink">
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-[#f7f8fa]/90 backdrop-blur">
        <Container className="flex items-center justify-between py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-300 bg-white text-sm font-semibold text-ink shadow-sm">
              R
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-ink">Reliai</p>
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Production AI reliability</p>
            </div>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <Link href="/#product" className="text-sm font-medium text-steel transition hover:text-ink">
              Product
            </Link>
            <Link href="/docs" className="text-sm font-medium text-steel transition hover:text-ink">
              Docs
            </Link>
            <Link href="/demo" className="text-sm font-medium text-steel transition hover:text-ink">
              Demo
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-steel transition hover:text-ink">
              Pricing
            </Link>
            <Link href="/login" className="text-sm font-medium text-steel transition hover:text-ink">
              Sign In
            </Link>
            <Button asChild size="sm">
              <Link href="/signup">Get Started</Link>
            </Button>
          </nav>
        </Container>
      </header>
      {children}
    </div>
  );
}
