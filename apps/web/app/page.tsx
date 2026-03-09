import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f4f6] px-6">
      <div className="w-full max-w-3xl rounded-2xl border border-line bg-white p-10 shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-steel">Reliai</p>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold text-ink">
          Detect, explain, and alert on AI production failures.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-steel">
          Reliai now includes tenant-scoped operator auth, a trace explorer, retrieval metadata,
          and the first evaluation scaffold on top of the ingest foundation.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild>
            <Link href="/sign-in">Open operator app</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/onboarding">View onboarding</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
