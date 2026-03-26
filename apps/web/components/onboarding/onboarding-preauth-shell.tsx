"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export function OnboardingPreAuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f3f4f6] text-ink">
      <header className="border-b border-zinc-200/80 bg-[#f3f4f6]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Reliai</p>
            <h1 className="text-lg font-semibold text-ink">AI reliability operations</h1>
          </div>
          <Link
            href="/sign-in"
            className="text-sm font-medium text-steel transition hover:text-ink"
          >
            Operator sign-in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        {children}
      </main>
    </div>
  );
}
