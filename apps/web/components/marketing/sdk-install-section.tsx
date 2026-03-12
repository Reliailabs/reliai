"use client";

import { useState } from "react";
import { Activity, Radar, ShieldCheck, Workflow } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { marketingCardClass } from "@/components/marketing/spatial-system";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const examples = {
  python: {
    label: "Python",
    install: "pip install reliai",
    code: `pip install reliai

import reliai

reliai.init(
    api_key="YOUR_API_KEY"
)

with reliai.span("llm_call"):
    response = client.chat.completions.create(...)`,
  },
  node: {
    label: "Node",
    install: "npm install reliai",
    code: `npm install reliai

import { reliai } from "reliai"

reliai.init({
  apiKey: process.env.RELIAI_API_KEY
})

await reliai.span("llm_call", async () => {
  return openai.chat.completions.create(...)
})`,
  },
} as const;

const badges = [
  {
    label: "Auto instrumentation",
    icon: Activity,
  },
  {
    label: "Distributed tracing",
    icon: Radar,
  },
  {
    label: "Runtime guardrails",
    icon: ShieldCheck,
  },
  {
    label: "Incident detection",
    icon: Workflow,
  },
];

export function SdkInstallSection() {
  const [activeTab, setActiveTab] = useState<keyof typeof examples>("python");
  const example = examples[activeTab];

  return (
    <Section className="border-b border-zinc-200 bg-white">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-steel">Install Reliai in 60 seconds</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              Install Reliai in 60 seconds
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-steel">
              Add reliability protection to your AI system with one SDK.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {Object.entries(examples).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key as keyof typeof examples)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-medium transition",
                    activeTab === key
                      ? "border-ink bg-ink text-white"
                      : "border-zinc-300 bg-white text-steel hover:text-ink",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            {badges.map((badge) => (
              <span
                key={badge.label}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-ink"
              >
                <badge.icon className="h-3.5 w-3.5 text-steel" />
                {badge.label}
              </span>
            ))}
          </div>
        </div>

        <Card className={cn(marketingCardClass, "mt-12 overflow-hidden p-0")}>
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
              {example.install}
            </div>
            <CopyButton value={example.code} label="Copy Code" />
          </div>
          <pre className="overflow-x-auto bg-zinc-950 px-5 py-5 text-sm leading-7 text-zinc-100">
            <code>{example.code}</code>
          </pre>
        </Card>
      </Container>
    </Section>
  );
}
