import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DemoConversionCard() {
  return (
    <section className="rounded-[32px] border border-demo-overlay bg-demo-overlay-glass px-8 py-8 text-textPrimary shadow-[0_20px_50px_rgba(2,6,23,0.45)]">
      <p className="text-xs uppercase tracking-[0.24em] text-textSecondary">Try it yourself</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-textPrimary">
        Try Reliai on your own system.
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-textSecondary">
        Move from the guided failure scenario into a real project, or skim the technical docs first.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/signup">
            Get Started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/docs">View Docs</Link>
        </Button>
      </div>
    </section>
  );
}
