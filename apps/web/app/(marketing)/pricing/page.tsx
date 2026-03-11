import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const tiers = [
  {
    name: "Evaluate",
    body: "Start with the interactive demo and SDK install path.",
  },
  {
    name: "Operate",
    body: "Use control panel, incidents, and deployment gates for one or more production AI systems.",
  },
  {
    name: "Scale",
    body: "Expand guardrails, policy coverage, and cross-project reliability operations.",
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.28em] text-steel">Pricing</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-ink">Commercial packaging for production AI reliability.</h1>
        <p className="mt-6 text-base leading-8 text-steel">
          This public page stays lightweight in the current slice. It frames how teams progress from evaluation to operating Reliai in production.
        </p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {tiers.map((tier) => (
          <Card key={tier.name} className="rounded-[28px] border-zinc-300 p-6">
            <h2 className="text-xl font-semibold text-ink">{tier.name}</h2>
            <p className="mt-3 text-sm leading-7 text-steel">{tier.body}</p>
          </Card>
        ))}
      </div>
      <div className="mt-10 flex gap-3">
        <Button asChild>
          <Link href="/signup">Get Started</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/demo">View Demo</Link>
        </Button>
      </div>
    </main>
  );
}
