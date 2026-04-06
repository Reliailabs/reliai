"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export function OnboardingPreAuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-page text-primary">
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <Link href="/" className="text-sm font-semibold tracking-tight text-primary">
            Reliai
          </Link>
          <Link
            href="/sign-in"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black"
          >
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-6 py-10">{children}</main>
    </div>
  );
}
