import { CheckCircle2, CircleDashed, KeyRound, Network, Radar } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const steps = [
  {
    label: "Create organization",
    state: "current",
    icon: Network,
    detail: "Register the tenant root used to scope projects, members, and onboarding."
  },
  {
    label: "Create project",
    state: "next",
    icon: CircleDashed,
    detail: "Provision a production, staging, or development project inside the organization."
  },
  {
    label: "Generate API key",
    state: "next",
    icon: KeyRound,
    detail: "Issue a project-scoped ingest key. The secret is revealed once."
  },
  {
    label: "Send first trace",
    state: "next",
    icon: Radar,
    detail: "POST a minimal trace payload to the ingestion endpoint and verify acceptance."
  }
];

export default function OnboardingPage() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
      <Card className="p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-steel">Onboarding</p>
        <h1 className="mt-3 text-3xl font-semibold">First trace path</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
          This shell teaches the smallest operator workflow that matters in Milestone 1: set up a
          tenant, issue an ingest key, and verify the first production trace lands.
        </p>

        <div className="mt-8 space-y-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCurrent = step.state === "current";
            return (
              <div
                key={step.label}
                className="grid gap-4 rounded-xl border border-line bg-surface px-4 py-4 md:grid-cols-[48px_minmax(0,1fr)_auto]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white">
                  <Icon className="h-5 w-5 text-ink" />
                </div>
                <div>
                  <p className="text-sm text-steel">Step {index + 1}</p>
                  <h2 className="mt-1 text-lg font-semibold">{step.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-steel">{step.detail}</p>
                </div>
                <div className="flex items-center">
                  {isCurrent ? (
                    <span className="rounded-full bg-accentSoft px-3 py-1 text-xs font-medium text-accent">
                      Current
                    </span>
                  ) : (
                    <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-steel">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="h-fit p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-steel">Ingest example</p>
        <div className="mt-4 rounded-xl bg-[#111827] p-4 text-sm text-zinc-100">
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono">
{`curl -X POST http://localhost:8000/api/v1/ingest/traces \\
  -H "x-api-key: reliai_..." \\
  -H "content-type: application/json" \\
  -d '{
    "timestamp":"2026-03-09T12:00:00Z",
    "request_id":"req_123",
    "model_name":"gpt-4.1-mini",
    "success":true
  }'`}
          </pre>
        </div>
        <div className="mt-5 rounded-xl border border-line bg-surface px-4 py-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-ink" />
            <p className="text-sm leading-6 text-steel">
              After the first accepted trace, Milestone 2 can build a trace explorer on top of the
              same project and trace records.
            </p>
          </div>
        </div>
        <Button className="mt-5 w-full">Create organization</Button>
      </Card>
    </div>
  );
}
