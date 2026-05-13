import Link from "next/link";

import { requireOperatorSession } from "@/lib/auth";

export default async function PlaygroundPage() {
  await requireOperatorSession();

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-8">
      <section className="rounded-2xl border border-border bg-card p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Playground</p>
        <h1 className="mt-3 text-3xl font-semibold text-foreground">Interactive Reliability Playground</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Pulse route ownership for playground is now wired. This slice keeps behavior read-only and
          migration-safe while preserving route parity and auth semantics.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/pulse" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
            Back to Pulse
          </Link>
          <Link href="/demo" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
            Open Demo Surface
          </Link>
        </div>
      </section>
    </main>
  );
}
