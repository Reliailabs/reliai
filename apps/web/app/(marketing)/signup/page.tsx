import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import {
  marketingCardClass,
  marketingContainerClass,
  marketingSectionLargeClass,
} from "@/components/marketing/spatial-system";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const steps = [
  "Create your organization",
  "Create your first project",
  "Install the SDK",
  "Send traces and open the control panel",
];

export default function SignupPage() {
  return (
    <main className={`${marketingContainerClass} ${marketingSectionLargeClass} pb-24`}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(320px,0.7fr)]">
        <section>
          <p className="text-xs uppercase tracking-[0.28em] text-secondary">Get started</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-primary">
            Set up Reliai around a real production AI path.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-secondary">
            This route is the public handoff into the real product. The current repo uses the existing operator auth flow, so account creation routes through sign-in for local development.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/sign-in">
                Continue to Sign In
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/demo">View Demo First</Link>
            </Button>
          </div>
        </section>

        <Card className={marketingCardClass}>
          <p className="text-xs uppercase tracking-[0.24em] text-secondary">Onboarding flow</p>
          <div className="mt-5 space-y-4">
            {steps.map((step) => (
              <div key={step} className="flex items-start gap-3 rounded-2xl border border-zinc-200 px-4 py-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" />
                <p className="text-sm leading-7 text-secondary">{step}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
